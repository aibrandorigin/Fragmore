import { AsyncLocalStorage } from 'node:async_hooks';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  runTransaction,
  getCountFromServer,
  Timestamp,
  type Transaction as FsTransaction
} from 'firebase/firestore';
import { getTableName, getTableColumns, type Table } from 'drizzle-orm';
import { firestore } from '../lib/firebase.ts';

interface ColumnMeta {
  jsKey: string;
  sqlName: string;
  isDate: boolean;
  isPrimary: boolean;
  hasDefault: boolean;
  defaultVal: any;
  defaultFn?: () => any;
  isSerial: boolean;
}

interface TableMeta {
  tableName: string;
  pkJsKey: string;
  pkSqlName: string;
  docIdJsKey: string; // usually pkJsKey; for `users` it's 'uid' for deterministic conflict upsert
  columnsByJs: Map<string, ColumnMeta>;
  columnsBySql: Map<string, ColumnMeta>;
  columnsList: ColumnMeta[];
}

const tableMetaCache = new WeakMap<object, TableMeta>();

function getTableMeta(table: Table | any): TableMeta {
  const cached = tableMetaCache.get(table);
  if (cached) return cached;

  const tableName = getTableName(table);
  const cols = getTableColumns(table);
  const columnsByJs = new Map<string, ColumnMeta>();
  const columnsBySql = new Map<string, ColumnMeta>();
  const columnsList: ColumnMeta[] = [];

  let pkJsKey = 'id';
  let pkSqlName = 'id';

  for (const [jsKey, col] of Object.entries(cols) as [string, any][]) {
    const isDate =
      col.dataType === 'date' ||
      col.columnType === 'PgTimestamp' ||
      col.constructor?.name === 'PgTimestamp';
    const isSerial =
      col.columnType === 'PgSerial' || col.constructor?.name === 'PgSerial';
    const meta: ColumnMeta = {
      jsKey,
      sqlName: col.name,
      isDate,
      isPrimary: Boolean(col.primary),
      hasDefault: Boolean(col.hasDefault),
      defaultVal: col.default,
      defaultFn: typeof col.defaultFn === 'function' ? col.defaultFn : undefined,
      isSerial
    };
    columnsByJs.set(jsKey, meta);
    columnsBySql.set(col.name, meta);
    columnsList.push(meta);
    if (meta.isPrimary) {
      pkJsKey = jsKey;
      pkSqlName = col.name;
    }
  }

  const docIdJsKey = tableName === 'users' && columnsByJs.has('uid') ? 'uid' : pkJsKey;

  const result: TableMeta = {
    tableName,
    pkJsKey,
    pkSqlName,
    docIdJsKey,
    columnsByJs,
    columnsBySql,
    columnsList
  };
  tableMetaCache.set(table, result);
  return result;
}

function deepClone<T>(v: T): T {
  if (v === null || v === undefined || typeof v !== 'object') return v;
  if (v instanceof Date) return new Date(v.getTime()) as unknown as T;
  if (Array.isArray(v)) return v.map((item) => deepClone(item)) as unknown as T;
  const out: Record<string, any> = {};
  for (const [k, val] of Object.entries(v)) {
    if (val !== undefined) out[k] = deepClone(val);
  }
  return out as T;
}

function toFirestoreValue(val: any, insideArray = false): any {
  if (val === undefined) return null;
  if (val === null) return null;
  if (val instanceof Date) return val.toISOString();
  if (val instanceof Timestamp) return val.toDate().toISOString();
  if (Array.isArray(val)) {
    const mapped = val.map((item) => toFirestoreValue(item, true));
    if (insideArray) {
      return { __fsNestedArray: true, items: mapped };
    }
    return mapped;
  }
  if (typeof val === 'object') {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(val)) {
      if (v !== undefined) {
        out[k] = toFirestoreValue(v, false);
      }
    }
    return out;
  }
  if (typeof val === 'number' && !Number.isFinite(val)) return null;
  return val;
}

function fromFirestoreValue(val: any): any {
  if (val === null || val === undefined) return val;
  if (Array.isArray(val)) {
    return val.map((item) => fromFirestoreValue(item));
  }
  if (typeof val === 'object') {
    if (val.__fsNestedArray === true && Array.isArray(val.items)) {
      return val.items.map((item: any) => fromFirestoreValue(item));
    }
    if (val instanceof Timestamp || typeof val.toDate === 'function' || val instanceof Date) {
      return val;
    }
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(val)) {
      out[k] = fromFirestoreValue(v);
    }
    return out;
  }
  return val;
}

function hydrateRow(meta: TableMeta, rawDoc: Record<string, any>, docId: string): Record<string, any> {
  const row: Record<string, any> = {};
  for (const col of meta.columnsList) {
    let val = rawDoc[col.jsKey];
    if (val === undefined && rawDoc[col.sqlName] !== undefined) {
      val = rawDoc[col.sqlName];
    }
    if (val === undefined) {
      if (col.jsKey === meta.docIdJsKey || col.isPrimary) {
        val = docId;
      } else {
        val = null;
      }
    }
    if (col.isDate && val !== null && val !== undefined) {
      if (val instanceof Date) {
        // ok
      } else if (val instanceof Timestamp || (typeof val === 'object' && typeof val.toDate === 'function')) {
        val = val.toDate();
      } else if (typeof val === 'string' || typeof val === 'number') {
        const parsed = new Date(val);
        val = Number.isNaN(parsed.getTime()) ? null : parsed;
      }
    } else {
      val = fromFirestoreValue(val);
    }
    row[col.jsKey] = val;
  }
  // Ensure primary/doc key preserved
  if (row[meta.docIdJsKey] === null || row[meta.docIdJsKey] === undefined) {
    row[meta.docIdJsKey] = docId;
  }
  return row;
}

function applyInsertDefaults(meta: TableMeta, input: Record<string, any>): Record<string, any> {
  const row: Record<string, any> = {};
  const now = new Date();

  for (const col of meta.columnsList) {
    let val = input[col.jsKey];
    if (val === undefined && col.sqlName !== col.jsKey && input[col.sqlName] !== undefined) {
      val = input[col.sqlName];
    }

    if (val === undefined) {
      if (col.isSerial) {
        val = Math.floor(Date.now() % 1000000000) + Math.floor(Math.random() * 1000);
      } else if (col.isDate && col.hasDefault) {
        val = now;
      } else if (col.defaultFn) {
        val = col.defaultFn();
      } else if (col.defaultVal !== undefined) {
        val = deepClone(col.defaultVal);
      } else {
        val = null;
      }
    } else if (col.isDate && val !== null) {
      if (!(val instanceof Date)) {
        const parsed = new Date(val);
        val = Number.isNaN(parsed.getTime()) ? now : parsed;
      }
    }
    row[col.jsKey] = val;
  }

  return row;
}

function serializeRowForFirestore(meta: TableMeta, row: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const col of meta.columnsList) {
    const val = row[col.jsKey];
    if (val === undefined) {
      out[col.jsKey] = null;
    } else {
      out[col.jsKey] = toFirestoreValue(val);
    }
  }
  return out;
}

// ============================================================================
// BOUNDED MEMORY LRU+TTL COLLECTION CACHE (Keeps Node RSS << 1GB RAM)
// ============================================================================
const MAX_CACHED_COLLECTIONS = 36;
const CACHE_TTL_MS = 30000;

interface CachedCollectionEntry {
  docs: Map<string, Record<string, any>>; // docId -> hydrated row
  expiresAt: number;
}

const collectionCache = new Map<string, CachedCollectionEntry>();

export function invalidateFirestoreCollectionCache(tableName?: string) {
  if (!tableName) {
    collectionCache.clear();
    return;
  }
  collectionCache.delete(tableName);
}

function setCachedCollection(tableName: string, docsMap: Map<string, Record<string, any>>) {
  if (collectionCache.has(tableName)) {
    collectionCache.delete(tableName);
  } else if (collectionCache.size >= MAX_CACHED_COLLECTIONS) {
    const oldestKey = collectionCache.keys().next().value;
    if (oldestKey) collectionCache.delete(oldestKey);
  }
  collectionCache.set(tableName, {
    docs: docsMap,
    expiresAt: Date.now() + CACHE_TTL_MS
  });
}

function getCachedCollection(tableName: string): Map<string, Record<string, any>> | null {
  const entry = collectionCache.get(tableName);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    collectionCache.delete(tableName);
    return null;
  }
  // Refresh LRU position
  collectionCache.delete(tableName);
  collectionCache.set(tableName, entry);
  return entry.docs;
}

// ============================================================================
// DRIZZLE SQL AST INTROSPECTION & EVALUATOR
// ============================================================================
type FlatToken =
  | { kind: 'str'; text: string }
  | { kind: 'col'; jsKey: string; sqlName: string }
  | { kind: 'val'; value: any };

function isSqlObj(v: any): boolean {
  return Boolean(v && typeof v === 'object' && Array.isArray(v.queryChunks));
}

function isColObj(v: any): boolean {
  return Boolean(v && typeof v === 'object' && typeof v.name === 'string' && 'table' in v);
}

function flattenSqlChunks(expr: any, meta: TableMeta, out: FlatToken[] = []): FlatToken[] {
  if (!expr) return out;
  if (isSqlObj(expr)) {
    for (const chunk of expr.queryChunks) {
      flattenSqlChunks(chunk, meta, out);
    }
    return out;
  }
  if (isColObj(expr)) {
    const colMeta = meta.columnsBySql.get(expr.name);
    out.push({
      kind: 'col',
      sqlName: expr.name,
      jsKey: colMeta ? colMeta.jsKey : expr.name
    });
    return out;
  }
  if (typeof expr === 'object' && expr.constructor?.name === 'StringChunk' && Array.isArray(expr.value)) {
    const txt = expr.value.join('');
    if (txt) out.push({ kind: 'str', text: txt });
    return out;
  }
  if (typeof expr === 'object' && expr.constructor?.name === 'Param') {
    out.push({ kind: 'val', value: expr.value });
    return out;
  }
  if (typeof expr === 'object' && Array.isArray(expr.value) && 'brand' in expr === false && expr.encoder) {
    out.push({ kind: 'val', value: expr.value });
    return out;
  }
  out.push({ kind: 'val', value: expr });
  return out;
}

// Extract exact primary-key lookup if query is `eq(pk, val)` or `and(eq(pk, val), ...)`
function extractDirectDocIdLookup(whereExpr: any, meta: TableMeta): string | null {
  if (!whereExpr || !isSqlObj(whereExpr)) return null;
  const chunks = whereExpr.queryChunks;
  // Direct binary eq: ["", Col, " = ", Param, ""]
  if (
    chunks.length >= 4 &&
    isColObj(chunks[1]) &&
    chunks[1].name === meta.columnsByJs.get(meta.docIdJsKey)?.sqlName &&
    chunks[2]?.value?.join?.('')?.trim() === '='
  ) {
    const paramNode = chunks[3];
    const v = paramNode && typeof paramNode === 'object' && 'value' in paramNode ? paramNode.value : paramNode;
    if (v !== undefined && v !== null) return String(v);
  }
  // `and(...)` wrapping first/any child with direct pk eq
  for (const ch of chunks) {
    if (isSqlObj(ch)) {
      const candidate = extractDirectDocIdLookup(ch, meta);
      if (candidate !== null) return candidate;
    }
  }
  return null;
}

function normalizeComparable(v: any): any {
  if (v instanceof Date) return v.getTime();
  if (v instanceof Timestamp) return v.toDate().getTime();
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v)) {
    const ms = Date.parse(v);
    if (!Number.isNaN(ms)) return ms;
  }
  return v;
}

function compareValues(a: any, b: any): number {
  if (a === b) return 0;
  if (a === null || a === undefined) return -1;
  if (b === null || b === undefined) return 1;
  const na = normalizeComparable(a);
  const nb = normalizeComparable(b);
  if (typeof na === 'number' && typeof nb === 'number') {
    return na - nb;
  }
  const sa = String(na);
  const sb = String(nb);
  return sa < sb ? -1 : sa > sb ? 1 : 0;
}

function matchLike(value: any, pattern: string, caseInsensitive: boolean): boolean {
  if (value === null || value === undefined) return false;
  const text = String(value);
  const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*').replace(/_/g, '.');
  const re = new RegExp(`^${escaped}$`, caseInsensitive ? 'is' : 's');
  return re.test(text);
}

// Parse flat tokens into an evaluator for row matching OR value computation
class TokenStream {
  private pos = 0;
  private meta: TableMeta;
  private tokens: Array<
    | { type: 'ident'; text: string }
    | { type: 'col'; jsKey: string }
    | { type: 'val'; value: any }
    | { type: 'op'; text: string }
    | { type: 'punct'; text: string }
  > = [];

  constructor(flat: FlatToken[], meta: TableMeta) {
    this.meta = meta;
    for (const tok of flat) {
      if (tok.kind === 'col') {
        this.tokens.push({ type: 'col', jsKey: tok.jsKey });
      } else if (tok.kind === 'val') {
        this.tokens.push({ type: 'val', value: tok.value });
      } else {
        this.lexString(tok.text);
      }
    }
  }

  private lexString(str: string) {
    let i = 0;
    while (i < str.length) {
      const ch = str[i];
      if (/\s/.test(ch)) {
        i++;
        continue;
      }
      if (ch === '(' || ch === ')' || ch === ',') {
        this.tokens.push({ type: 'punct', text: ch });
        i++;
        continue;
      }
      if (ch === "'" || ch === '"') {
        const quote = ch;
        i++;
        let lit = '';
        while (i < str.length && str[i] !== quote) {
          lit += str[i++];
        }
        i++; // skip closing quote
        this.tokens.push({ type: 'val', value: lit });
        continue;
      }
      const two = str.slice(i, i + 2);
      if (two === '<>' || two === '!=' || two === '<=' || two === '>=') {
        this.tokens.push({ type: 'op', text: two });
        i += 2;
        continue;
      }
      if ('=<>+-*/'.includes(ch)) {
        this.tokens.push({ type: 'op', text: ch });
        i++;
        continue;
      }
      // word or number
      let word = '';
      while (i < str.length && /[a-zA-Z0-9_.]/.test(str[i])) {
        word += str[i++];
      }
      if (word) {
        if (/^-?\d+(\.\d+)?$/.test(word)) {
          this.tokens.push({ type: 'val', value: Number(word) });
        } else {
          const upper = word.toUpperCase();
          if (upper === 'NULL') {
            this.tokens.push({ type: 'val', value: null });
          } else if (upper === 'TRUE') {
            this.tokens.push({ type: 'val', value: true });
          } else if (upper === 'FALSE') {
            this.tokens.push({ type: 'val', value: false });
          } else {
            this.tokens.push({ type: 'ident', text: word });
          }
        }
      } else {
        i++;
      }
    }
  }

  peek(offset = 0) {
    return this.tokens[this.pos + offset];
  }
  consume() {
    return this.tokens[this.pos++];
  }

  private peekIsIdent(kwUpper: string, offset = 0): boolean {
    const t = this.tokens[this.pos + offset];
    return t?.type === 'ident' && t.text.toUpperCase() === kwUpper;
  }

  private peekIsPunct(ch: string, offset = 0): boolean {
    const t = this.tokens[this.pos + offset];
    return t?.type === 'punct' && t.text === ch;
  }

  private peekOpText(offset = 0): string | null {
    const t = this.tokens[this.pos + offset];
    return t?.type === 'op' ? t.text : null;
  }

  evalCondition(row: Record<string, any>): boolean {
    if (this.tokens.length === 0) return true;
    return Boolean(this.parseOr(row));
  }

  evalValue(row: Record<string, any>): any {
    if (this.tokens.length === 0) return null;
    return this.parseAddSub(row);
  }

  private parseOr(row: Record<string, any>): any {
    let left = this.parseAnd(row);
    while (this.peekIsIdent('OR')) {
      this.consume();
      const right = this.parseAnd(row);
      left = Boolean(left) || Boolean(right);
    }
    return left;
  }

  private parseAnd(row: Record<string, any>): any {
    let left = this.parseNot(row);
    while (this.peekIsIdent('AND')) {
      this.consume();
      const right = this.parseNot(row);
      left = Boolean(left) && Boolean(right);
    }
    return left;
  }

  private parseNot(row: Record<string, any>): any {
    if (this.peekIsIdent('NOT')) {
      this.consume();
      return !this.parseComparison(row);
    }
    return this.parseComparison(row);
  }

  private parseComparison(row: Record<string, any>): any {
    const left = this.parseAddSub(row);
    const nxt = this.peek();
    if (!nxt) return left;

    if (nxt.type === 'ident') {
      const kw = nxt.text.toUpperCase();
      if (kw === 'IS') {
        this.consume();
        let negate = false;
        if (this.peekIsIdent('NOT')) {
          this.consume();
          negate = true;
        }
        const target = this.peek();
        if (target?.type === 'val' && target.value === null) {
          this.consume();
          const isNullVal = left === null || left === undefined;
          return negate ? !isNullVal : isNullVal;
        }
        return false;
      }
      if (kw === 'NOT') {
        if (this.peekIsIdent('IN', 1)) {
          this.consume(); // NOT
          this.consume(); // IN
          const arr = this.parseInList(row);
          return !arr.some((item) => compareValues(left, item) === 0);
        }
      }
      if (kw === 'IN') {
        this.consume();
        const arr = this.parseInList(row);
        return arr.some((item) => compareValues(left, item) === 0);
      }
      if (kw === 'ILIKE' || kw === 'LIKE') {
        this.consume();
        const pat = this.parseAddSub(row);
        return matchLike(left, String(pat || ''), kw === 'ILIKE');
      }
    }

    if (nxt.type === 'op') {
      const op = nxt.text;
      if (op === '=' || op === '!=' || op === '<>' || op === '<' || op === '<=' || op === '>' || op === '>=') {
        this.consume();
        const right = this.parseAddSub(row);
        if (op === '=') {
          if (left === null || right === null) return left === right;
          return compareValues(left, right) === 0;
        }
        if (op === '!=' || op === '<>') {
          if (left === null || right === null) return left !== right;
          return compareValues(left, right) !== 0;
        }
        if (left === null || left === undefined || right === null || right === undefined) return false;
        const cmp = compareValues(left, right);
        if (op === '<') return cmp < 0;
        if (op === '<=') return cmp <= 0;
        if (op === '>') return cmp > 0;
        if (op === '>=') return cmp >= 0;
      }
    }

    return left;
  }

  private parseInList(row: Record<string, any>): any[] {
    const first = this.peek();
    if (first?.type === 'val' && Array.isArray(first.value)) {
      this.consume();
      return first.value;
    }
    if (this.peekIsPunct('(')) {
      this.consume();
      const items: any[] = [];
      while (this.peek() && !this.peekIsPunct(')')) {
        if (this.peekIsPunct(',')) {
          this.consume();
          continue;
        }
        const v = this.parseAddSub(row);
        if (Array.isArray(v)) items.push(...v);
        else items.push(v);
      }
      if (this.peekIsPunct(')')) this.consume();
      return items;
    }
    const single = this.parseAddSub(row);
    return Array.isArray(single) ? single : [single];
  }

  private parseAddSub(row: Record<string, any>): any {
    let left = this.parseMulDiv(row);
    while (true) {
      const op = this.peekOpText();
      if (op !== '+' && op !== '-') break;
      this.consume();
      const right = this.parseMulDiv(row);
      const nl = Number(left ?? 0);
      const nr = Number(right ?? 0);
      left = op === '+' ? nl + nr : nl - nr;
    }
    return left;
  }

  private parseMulDiv(row: Record<string, any>): any {
    let left = this.parsePrimary(row);
    while (true) {
      const op = this.peekOpText();
      if (op !== '*' && op !== '/') break;
      this.consume();
      const right = this.parsePrimary(row);
      const nl = Number(left ?? 0);
      const nr = Number(right ?? 1);
      left = op === '*' ? nl * nr : nr === 0 ? 0 : nl / nr;
    }
    return left;
  }

  private parsePrimary(row: Record<string, any>): any {
    const tok = this.peek();
    if (!tok) return null;

    if (tok.type === 'punct' && tok.text === '(') {
      this.consume();
      const inner = this.parseOr(row);
      if (this.peekIsPunct(')')) this.consume();
      return inner;
    }

    if (tok.type === 'col') {
      this.consume();
      return row[tok.jsKey] ?? null;
    }

    if (tok.type === 'val') {
      this.consume();
      return tok.value;
    }

    if (tok.type === 'ident') {
      const nameUpper = tok.text.toUpperCase();
      if (this.peekIsPunct('(', 1)) {
        this.consume(); // func name
        this.consume(); // '('
        const args: any[] = [];
        while (this.peek() && !this.peekIsPunct(')')) {
          if (this.peekIsPunct(',')) {
            this.consume();
            continue;
          }
          args.push(this.parseOr(row));
        }
        if (this.peekIsPunct(')')) this.consume();
        if (nameUpper === 'LOWER') return String(args[0] ?? '').toLowerCase();
        if (nameUpper === 'UPPER') return String(args[0] ?? '').toUpperCase();
        if (nameUpper === 'GREATEST') return Math.max(...args.map((a) => Number(a ?? 0)));
        if (nameUpper === 'LEAST') return Math.min(...args.map((a) => Number(a ?? 0)));
        if (nameUpper === 'COALESCE') return args.find((a) => a !== null && a !== undefined) ?? null;
        return args[0] ?? null;
      }

      this.consume();
      const colBySql = this.meta.columnsBySql.get(tok.text) || this.meta.columnsByJs.get(tok.text);
      if (colBySql) {
        return row[colBySql.jsKey] ?? null;
      }
      return row[tok.text] ?? null;
    }

    this.consume();
    return null;
  }
}

function evaluateWhere(expr: any, meta: TableMeta, row: Record<string, any>): boolean {
  if (!expr) return true;
  const flat = flattenSqlChunks(expr, meta);
  return new TokenStream(flat, meta).evalCondition(row);
}

function evaluateSetExpression(expr: any, meta: TableMeta, existingRow: Record<string, any>): any {
  if (expr === null || expr === undefined) return expr;
  if (isSqlObj(expr)) {
    const flat = flattenSqlChunks(expr, meta);
    return new TokenStream(flat, meta).evalValue(existingRow);
  }
  return expr;
}

function parseOrderBy(orderExprs: any[], meta: TableMeta): Array<{ jsKey: string; dir: 'asc' | 'desc' }> {
  const specs: Array<{ jsKey: string; dir: 'asc' | 'desc' }> = [];
  for (const item of orderExprs) {
    if (!item) continue;
    if (isColObj(item)) {
      const cm = meta.columnsBySql.get(item.name);
      specs.push({ jsKey: cm ? cm.jsKey : item.name, dir: 'asc' });
      continue;
    }
    if (isSqlObj(item)) {
      const flat = flattenSqlChunks(item, meta);
      const colTok = flat.find((t) => t.kind === 'col') as { kind: 'col'; jsKey: string } | undefined;
      const text = flat.filter((t) => t.kind === 'str').map((t: any) => t.text).join(' ').toLowerCase();
      if (colTok) {
        specs.push({ jsKey: colTok.jsKey, dir: text.includes('desc') ? 'desc' : 'asc' });
      }
    }
  }
  return specs;
}

function sortRows(rows: Record<string, any>[], orderSpecs: Array<{ jsKey: string; dir: 'asc' | 'desc' }>): Record<string, any>[] {
  if (!orderSpecs.length) return rows;
  return [...rows].sort((a, b) => {
    for (const spec of orderSpecs) {
      const cmp = compareValues(a[spec.jsKey], b[spec.jsKey]);
      if (cmp !== 0) {
        return spec.dir === 'desc' ? -cmp : cmp;
      }
    }
    return 0;
  });
}

function projectRow(row: Record<string, any>, selection: Record<string, any> | undefined, meta: TableMeta, totalCount?: number): Record<string, any> {
  if (!selection) return deepClone(row);
  const out: Record<string, any> = {};
  for (const [alias, target] of Object.entries(selection)) {
    if (isColObj(target)) {
      const cm = meta.columnsBySql.get(target.name);
      const jsKey = cm ? cm.jsKey : target.name;
      out[alias] = deepClone(row[jsKey] ?? null);
    } else if (isSqlObj(target)) {
      const flat = flattenSqlChunks(target, meta);
      const rawText = flat.filter((t) => t.kind === 'str').map((t: any) => t.text).join('').toLowerCase();
      if (rawText.includes('count(')) {
        out[alias] = totalCount ?? 0;
      } else {
        out[alias] = new TokenStream(flat, meta).evalValue(row);
      }
    } else {
      out[alias] = target;
    }
  }
  return out;
}

// ============================================================================
// FIRESTORE ACCESS CONTEXT (Supports both direct DB and Buffered ACID Tx)
// ============================================================================
interface TxOverlay {
  stagedDocs: Map<string, Map<string, Record<string, any> | null>>; // tableName -> docId -> row | null (deleted)
  deletedFullCollections: Set<string>;
}

interface ExecutionContext {
  fsTx?: FsTransaction;
  overlay?: TxOverlay;
}

async function loadCollectionRows(
  meta: TableMeta,
  ctx: ExecutionContext
): Promise<Map<string, Record<string, any>>> {
  const overlayMap = ctx.overlay?.stagedDocs.get(meta.tableName);
  let baseMap = getCachedCollection(meta.tableName);

  if (!baseMap || ctx.fsTx) {
    const snap = await getDocs(collection(firestore, meta.tableName));
    baseMap = new Map<string, Record<string, any>>();
    snap.forEach((docSnap) => {
      baseMap!.set(docSnap.id, hydrateRow(meta, docSnap.data(), docSnap.id));
    });
    if (!ctx.fsTx) {
      setCachedCollection(meta.tableName, baseMap);
    }
  }

  // Clone baseMap and overlay staged tx writes if inside a transaction
  const effectiveMap = new Map<string, Record<string, any>>();
  if (!ctx.overlay?.deletedFullCollections.has(meta.tableName)) {
    for (const [docId, r] of baseMap.entries()) {
      effectiveMap.set(docId, deepClone(r));
    }
  }
  if (overlayMap) {
    for (const [docId, r] of overlayMap.entries()) {
      if (r === null) {
        effectiveMap.delete(docId);
      } else {
        effectiveMap.set(docId, deepClone(r));
      }
    }
  }
  return effectiveMap;
}

async function getSingleDocDirect(
  meta: TableMeta,
  docId: string,
  ctx: ExecutionContext
): Promise<Record<string, any> | null> {
  const overlayMap = ctx.overlay?.stagedDocs.get(meta.tableName);
  if (overlayMap && overlayMap.has(docId)) {
    const staged = overlayMap.get(docId);
    return staged ? deepClone(staged) : null;
  }
  if (ctx.overlay?.deletedFullCollections.has(meta.tableName)) {
    return null;
  }

  const cached = getCachedCollection(meta.tableName);
  if (cached && !ctx.fsTx) {
    const hit = cached.get(docId);
    return hit ? deepClone(hit) : null;
  }

  const ref = doc(firestore, meta.tableName, docId);
  const snap = ctx.fsTx ? await ctx.fsTx.get(ref) : await getDoc(ref);
  if (!snap.exists()) return null;
  return hydrateRow(meta, snap.data(), snap.id);
}

function stageWriteInContext(
  meta: TableMeta,
  docId: string,
  row: Record<string, any> | null,
  ctx: ExecutionContext
) {
  if (ctx.overlay) {
    let tMap = ctx.overlay.stagedDocs.get(meta.tableName);
    if (!tMap) {
      tMap = new Map();
      ctx.overlay.stagedDocs.set(meta.tableName, tMap);
    }
    tMap.set(docId, row ? deepClone(row) : null);
  }
}

// ============================================================================
// DRIZZLE QUERY BUILDERS
// ============================================================================
class FirestoreSelectBuilder implements PromiseLike<any[]> {
  private selection: Record<string, any> | undefined;
  private ctx: ExecutionContext;
  private tableObj: any;
  private whereExpr: any;
  private orderExprs: any[] = [];
  private limitVal: number | undefined;
  private offsetVal: number | undefined;

  constructor(selection: Record<string, any> | undefined, ctx: ExecutionContext) {
    this.selection = selection;
    this.ctx = ctx;
  }

  from(table: any) {
    this.tableObj = table;
    return this;
  }

  where(expr: any) {
    this.whereExpr = expr;
    return this;
  }

  orderBy(...exprs: any[]) {
    this.orderExprs = exprs.flat();
    return this;
  }

  limit(n: number) {
    this.limitVal = n;
    return this;
  }

  offset(n: number) {
    this.offsetVal = n;
    return this;
  }

  for(_mode: string) {
    return this;
  }

  private async execute(): Promise<any[]> {
    const meta = getTableMeta(this.tableObj);

    // Check `count(*)` fast path
    const isCountOnly =
      this.selection &&
      Object.values(this.selection).length === 1 &&
      isSqlObj(Object.values(this.selection)[0]) &&
      flattenSqlChunks(Object.values(this.selection)[0], meta)
        .filter((t) => t.kind === 'str')
        .map((t: any) => t.text.toLowerCase())
        .join('')
        .includes('count(');

    if (isCountOnly && !this.whereExpr && !this.ctx.overlay) {
      const cached = getCachedCollection(meta.tableName);
      if (cached) {
        return [projectRow({}, this.selection, meta, cached.size)];
      }
      const countSnap = await getCountFromServer(collection(firestore, meta.tableName));
      return [projectRow({}, this.selection, meta, countSnap.data().count)];
    }

    // Direct PK lookup fast path
    let candidateRows: Record<string, any>[];
    const directId = this.whereExpr ? extractDirectDocIdLookup(this.whereExpr, meta) : null;
    if (directId !== null) {
      const single = await getSingleDocDirect(meta, directId, this.ctx);
      candidateRows = single && evaluateWhere(this.whereExpr, meta, single) ? [single] : [];
    } else {
      const allMap = await loadCollectionRows(meta, this.ctx);
      candidateRows = [];
      for (const r of allMap.values()) {
        if (!this.whereExpr || evaluateWhere(this.whereExpr, meta, r)) {
          candidateRows.push(r);
        }
      }
    }

    if (isCountOnly) {
      return [projectRow({}, this.selection, meta, candidateRows.length)];
    }

    if (this.orderExprs.length > 0) {
      const specs = parseOrderBy(this.orderExprs, meta);
      candidateRows = sortRows(candidateRows, specs);
    }

    const start = this.offsetVal ?? 0;
    const end = this.limitVal !== undefined ? start + this.limitVal : undefined;
    const sliced = candidateRows.slice(start, end);

    if (!this.selection) return sliced;
    return sliced.map((r) => projectRow(r, this.selection, meta));
  }

  then<TResult1 = any[], TResult2 = never>(
    onfulfilled?: ((value: any[]) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }
}

class FirestoreInsertBuilder implements PromiseLike<any[]> {
  private tableObj: any;
  private ctx: ExecutionContext;
  private valuesList: Record<string, any>[] = [];
  private conflictMode: 'none' | 'nothing' | 'update' = 'none';
  private conflictTargetCols: string[] = [];
  private conflictSetObj: Record<string, any> | undefined;
  private shouldReturn = false;

  constructor(tableObj: any, ctx: ExecutionContext) {
    this.tableObj = tableObj;
    this.ctx = ctx;
  }

  values(vals: Record<string, any> | Record<string, any>[]) {
    this.valuesList = Array.isArray(vals) ? vals : [vals];
    return this;
  }

  onConflictDoNothing(_opts?: any) {
    this.conflictMode = 'nothing';
    if (_opts?.target) {
      const targets = Array.isArray(_opts.target) ? _opts.target : [_opts.target];
      this.conflictTargetCols = targets.map((t: any) => t?.name).filter(Boolean);
    }
    return this;
  }

  onConflictDoUpdate(opts: { target: any; set: Record<string, any> }) {
    this.conflictMode = 'update';
    const targets = Array.isArray(opts.target) ? opts.target : [opts.target];
    this.conflictTargetCols = targets.map((t: any) => t?.name).filter(Boolean);
    this.conflictSetObj = opts.set;
    return this;
  }

  returning(_fields?: any) {
    this.shouldReturn = true;
    return this;
  }

  private async execute(): Promise<any[]> {
    if (this.valuesList.length === 0) return [];
    const meta = getTableMeta(this.tableObj);
    const results: Record<string, any>[] = [];
    const toWrite: Array<{ docId: string; row: Record<string, any> }> = [];

    // Check existing docs when conflict handling applies or batch check
    const needConflictCheck = this.conflictMode !== 'none';
    let existingMap: Map<string, Record<string, any>> | null = null;
    if (needConflictCheck && this.valuesList.length > 1) {
      existingMap = await loadCollectionRows(meta, this.ctx);
    }

    for (const rawVal of this.valuesList) {
      const newRow = applyInsertDefaults(meta, rawVal);
      const docId = String(newRow[meta.docIdJsKey] ?? '');
      if (!docId) {
        throw new Error(`Missing primary key (${meta.docIdJsKey}) for insert into ${meta.tableName}`);
      }

      if (needConflictCheck) {
        let existing: Record<string, any> | null = null;
        if (existingMap) {
          existing = existingMap.get(docId) || null;
          if (!existing && this.conflictTargetCols.length > 0) {
            const targetSql = this.conflictTargetCols[0];
            const targetJs = meta.columnsBySql.get(targetSql)?.jsKey || targetSql;
            for (const r of existingMap.values()) {
              if (r[targetJs] !== undefined && r[targetJs] === newRow[targetJs]) {
                existing = r;
                break;
              }
            }
          }
        } else {
          existing = await getSingleDocDirect(meta, docId, this.ctx);
        }

        if (existing) {
          if (this.conflictMode === 'nothing') {
            continue;
          }
          if (this.conflictMode === 'update' && this.conflictSetObj) {
            const merged = deepClone(existing);
            for (const [k, expr] of Object.entries(this.conflictSetObj)) {
              merged[k] = evaluateSetExpression(expr, meta, existing);
            }
            const existingDocId = String(existing[meta.docIdJsKey] ?? docId);
            toWrite.push({ docId: existingDocId, row: merged });
            results.push(deepClone(merged));
            continue;
          }
        }
      }

      toWrite.push({ docId, row: newRow });
      results.push(deepClone(newRow));
    }

    if (toWrite.length > 0) {
      if (this.ctx.overlay) {
        for (const item of toWrite) {
          stageWriteInContext(meta, item.docId, item.row, this.ctx);
        }
      } else {
        for (let i = 0; i < toWrite.length; i += 400) {
          const chunk = toWrite.slice(i, i + 400);
          const batch = writeBatch(firestore);
          for (const item of chunk) {
            batch.set(doc(firestore, meta.tableName, item.docId), serializeRowForFirestore(meta, item.row));
          }
          await batch.commit();
        }
        invalidateFirestoreCollectionCache(meta.tableName);
      }
    }

    return this.shouldReturn ? results : results;
  }

  then<TResult1 = any[], TResult2 = never>(
    onfulfilled?: ((value: any[]) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }
}

class FirestoreUpdateBuilder implements PromiseLike<any[]> {
  private tableObj: any;
  private ctx: ExecutionContext;
  private setObj: Record<string, any> = {};
  private whereExpr: any;
  private shouldReturn = false;

  constructor(tableObj: any, ctx: ExecutionContext) {
    this.tableObj = tableObj;
    this.ctx = ctx;
  }

  set(values: Record<string, any>) {
    this.setObj = values;
    return this;
  }

  where(expr: any) {
    this.whereExpr = expr;
    return this;
  }

  returning(_fields?: any) {
    this.shouldReturn = true;
    return this;
  }

  private async execute(): Promise<any[]> {
    const meta = getTableMeta(this.tableObj);
    const matched: Array<{ docId: string; row: Record<string, any> }> = [];

    const directId = this.whereExpr ? extractDirectDocIdLookup(this.whereExpr, meta) : null;
    if (directId !== null) {
      const existing = await getSingleDocDirect(meta, directId, this.ctx);
      if (existing && evaluateWhere(this.whereExpr, meta, existing)) {
        matched.push({ docId: directId, row: existing });
      }
    } else {
      const allMap = await loadCollectionRows(meta, this.ctx);
      for (const [docId, r] of allMap.entries()) {
        if (!this.whereExpr || evaluateWhere(this.whereExpr, meta, r)) {
          matched.push({ docId, row: r });
        }
      }
    }

    if (matched.length === 0) return [];

    const updatedRows: Record<string, any>[] = [];
    const writes: Array<{ docId: string; row: Record<string, any>; payload: Record<string, any> }> = [];

    for (const item of matched) {
      const next = deepClone(item.row);
      const partialPayload: Record<string, any> = {};
      for (const [k, expr] of Object.entries(this.setObj)) {
        if (expr === undefined) continue;
        const val = evaluateSetExpression(expr, meta, item.row);
        next[k] = val;
        partialPayload[k] = toFirestoreValue(val);
      }
      writes.push({ docId: item.docId, row: next, payload: partialPayload });
      updatedRows.push(next);
    }

    if (this.ctx.overlay) {
      for (const w of writes) {
        stageWriteInContext(meta, w.docId, w.row, this.ctx);
      }
    } else if (writes.length === 1) {
      const w = writes[0];
      await setDoc(doc(firestore, meta.tableName, w.docId), w.payload, { merge: true });
      invalidateFirestoreCollectionCache(meta.tableName);
    } else {
      for (let i = 0; i < writes.length; i += 400) {
        const chunk = writes.slice(i, i + 400);
        const batch = writeBatch(firestore);
        for (const w of chunk) {
          batch.set(doc(firestore, meta.tableName, w.docId), w.payload, { merge: true });
        }
        await batch.commit();
      }
      invalidateFirestoreCollectionCache(meta.tableName);
    }

    return updatedRows;
  }

  then<TResult1 = any[], TResult2 = never>(
    onfulfilled?: ((value: any[]) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }
}

class FirestoreDeleteBuilder implements PromiseLike<any[]> {
  private tableObj: any;
  private ctx: ExecutionContext;
  private whereExpr: any;
  private shouldReturn = false;

  constructor(tableObj: any, ctx: ExecutionContext) {
    this.tableObj = tableObj;
    this.ctx = ctx;
  }

  where(expr: any) {
    this.whereExpr = expr;
    return this;
  }

  returning(_fields?: any) {
    this.shouldReturn = true;
    return this;
  }

  private async execute(): Promise<any[]> {
    const meta = getTableMeta(this.tableObj);
    const matched: Array<{ docId: string; row: Record<string, any> }> = [];

    const directId = this.whereExpr ? extractDirectDocIdLookup(this.whereExpr, meta) : null;
    if (directId !== null) {
      const existing = await getSingleDocDirect(meta, directId, this.ctx);
      if (existing && evaluateWhere(this.whereExpr, meta, existing)) {
        matched.push({ docId: directId, row: existing });
      }
    } else {
      const allMap = await loadCollectionRows(meta, this.ctx);
      for (const [docId, r] of allMap.entries()) {
        if (!this.whereExpr || evaluateWhere(this.whereExpr, meta, r)) {
          matched.push({ docId, row: r });
        }
      }
    }

    if (matched.length === 0) return [];

    if (this.ctx.overlay) {
      if (!this.whereExpr) {
        this.ctx.overlay.deletedFullCollections.add(meta.tableName);
      }
      for (const m of matched) {
        stageWriteInContext(meta, m.docId, null, this.ctx);
      }
    } else if (matched.length === 1) {
      await deleteDoc(doc(firestore, meta.tableName, matched[0].docId));
      invalidateFirestoreCollectionCache(meta.tableName);
    } else {
      for (let i = 0; i < matched.length; i += 400) {
        const chunk = matched.slice(i, i + 400);
        const batch = writeBatch(firestore);
        for (const m of chunk) {
          batch.delete(doc(firestore, meta.tableName, m.docId));
        }
        await batch.commit();
      }
      invalidateFirestoreCollectionCache(meta.tableName);
    }

    return matched.map((m) => m.row);
  }

  then<TResult1 = any[], TResult2 = never>(
    onfulfilled?: ((value: any[]) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }
}

// Serialize concurrent in-process transactions so multiple local wallet/inventory updates don't thrash
let txMutexQueue: Promise<any> = Promise.resolve();
const txContextStorage = new AsyncLocalStorage<ExecutionContext>();

function resolveEffectiveContext(ctx: ExecutionContext): ExecutionContext {
  if (ctx.fsTx && ctx.overlay) return ctx;
  const active = txContextStorage.getStore();
  if (active?.fsTx && active?.overlay) return active;
  return ctx;
}

function createDbInterface(ctx: ExecutionContext, schemaTablesByName?: Map<string, any>) {
  return {
    select(fields?: Record<string, any>) {
      return new FirestoreSelectBuilder(fields, resolveEffectiveContext(ctx));
    },
    insert(table: any) {
      return new FirestoreInsertBuilder(table, resolveEffectiveContext(ctx));
    },
    update(table: any) {
      return new FirestoreUpdateBuilder(table, resolveEffectiveContext(ctx));
    },
    delete(table: any) {
      return new FirestoreDeleteBuilder(table, resolveEffectiveContext(ctx));
    },
    async transaction<T>(fn: (tx: any) => Promise<T>): Promise<T> {
      // Nested / re-entrant transaction support: reuse active tx overlay via explicit ctx or AsyncLocalStorage
      const activeCtx = (ctx.fsTx && ctx.overlay) ? ctx : txContextStorage.getStore();
      if (activeCtx?.fsTx && activeCtx?.overlay) {
        return fn(createDbInterface(activeCtx, schemaTablesByName));
      }

      const runTask = async (): Promise<T> => {
        const touchedCollections = new Set<string>();
        const result = await runTransaction(firestore, async (fsTx) => {
          const overlay: TxOverlay = {
            stagedDocs: new Map(),
            deletedFullCollections: new Set()
          };
          const txCtx: ExecutionContext = { fsTx, overlay };
          const txDb = createDbInterface(txCtx, schemaTablesByName);
          const out = await txContextStorage.run(txCtx, () => fn(txDb));

          // Flush all staged mutations AFTER all fsTx.get reads have finished
          for (const [tableName, docsMap] of overlay.stagedDocs.entries()) {
            touchedCollections.add(tableName);
            const tableObj = schemaTablesByName?.get(tableName);
            const meta = tableObj ? getTableMeta(tableObj) : null;
            for (const [docId, row] of docsMap.entries()) {
              const ref = doc(firestore, tableName, docId);
              if (row === null) {
                fsTx.delete(ref);
              } else {
                const payload = meta ? serializeRowForFirestore(meta, row) : toFirestoreValue(row);
                fsTx.set(ref, payload);
              }
            }
          }
          return out;
        });

        for (const tName of touchedCollections) {
          invalidateFirestoreCollectionCache(tName);
        }
        return result;
      };

      const nextPromise = txMutexQueue.then(runTask, runTask);
      txMutexQueue = nextPromise.catch(() => {});
      return nextPromise;
    }
  };
}

export function createFirestoreDrizzleDb(schema: Record<string, any>) {
  const tablesByName = new Map<string, any>();
  for (const val of Object.values(schema)) {
    if (val && typeof val === 'object' && Symbol.for('drizzle:Name') in val) {
      tablesByName.set(getTableName(val as any), val);
    }
  }
  return createDbInterface({}, tablesByName);
}

export { getTableMeta, serializeRowForFirestore, hydrateRow };
