import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface PerfumeBottle3DProps {
  color?: string; // Liquid color hex
  ambientColor?: string;
  fragranceName?: string;
  mode?: 'single' | 'all-six';
  progress?: number; // 0 to 1 for scroll transition
  interactive?: boolean;
  className?: string;
}

const MILD_GOLD_LIQUID_HEX = 0xe8c978;

const FRAGRANCE_PALETTES = [
  { name: 'AZURE', color: MILD_GOLD_LIQUID_HEX, glass: 0xfafafa, particles: 0xf3e3b4 },
  { name: 'IGNITE', color: MILD_GOLD_LIQUID_HEX, glass: 0xfafafa, particles: 0xf3e3b4 },
  { name: 'ROSELLE', color: MILD_GOLD_LIQUID_HEX, glass: 0xfafafa, particles: 0xf3e3b4 },
  { name: 'ÉLAN', color: MILD_GOLD_LIQUID_HEX, glass: 0xfafafa, particles: 0xf3e3b4 },
  { name: 'SUEDE', color: MILD_GOLD_LIQUID_HEX, glass: 0xfafafa, particles: 0xf3e3b4 },
  { name: 'SOLARA', color: MILD_GOLD_LIQUID_HEX, glass: 0xfafafa, particles: 0xf3e3b4 }
];

export const PerfumeBottle3D: React.FC<PerfumeBottle3DProps> = ({
  color = '#E8C978',
  ambientColor = '#F3E3B4',
  fragranceName = 'AZURE',
  mode = 'single',
  progress = 0,
  interactive = true,
  className = 'w-full h-full'
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const targetRotation = useRef({ x: 0, y: 0 });
  const mousePos = useRef({ x: 0, y: 0 });
  const liquidMaterialRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const bottlesGroupRef = useRef<THREE.Group | null>(null);
  const particlesRef = useRef<THREE.Points | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    // Scene
    const scene = new THREE.Scene();

    // Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 0, 8.5);

    // Renderer
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance'
      });
    } catch {
      return;
    }

    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.35;
    container.appendChild(renderer.domElement);

    // Lighting
    const keyLight = new THREE.DirectionalLight(0xfff8ee, 3.2);
    keyLight.position.set(4, 6, 5);
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0xffd700, 2.5);
    rimLight.position.set(-5, 4, -4);
    scene.add(rimLight);

    const fillLight = new THREE.DirectionalLight(0xd4af37, 1.2);
    fillLight.position.set(0, -4, 4);
    scene.add(fillLight);

    const ambientLight = new THREE.AmbientLight(0x222230, 1.4);
    scene.add(ambientLight);

    // Helper: Create a single luxury bottle
    const createBottle = (bottleColorHex: number, labelText: string = 'FRAGMORÉ') => {
      const bottleGroup = new THREE.Group();

      // Outer Heavy Crystal Glass
      const glassGeo = new THREE.CylinderGeometry(0.88, 0.88, 2.7, 32);
      const glassMat = new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        metalness: 0.05,
        roughness: 0.06,
        transmission: 0.88,
        thickness: 0.7,
        transparent: true,
        opacity: 0.92,
        reflectivity: 0.95,
        clearcoat: 1.0,
        clearcoatRoughness: 0.05
      });
      const glassMesh = new THREE.Mesh(glassGeo, glassMat);
      bottleGroup.add(glassMesh);

      // Inner Liquid Nectar (Mild Champagne Gold)
      const liquidGeo = new THREE.CylinderGeometry(0.74, 0.74, 2.3, 32);
      const liquidMat = new THREE.MeshStandardMaterial({
        color: MILD_GOLD_LIQUID_HEX,
        emissive: 0x3b2c0a,
        emissiveIntensity: 0.14,
        roughness: 0.14,
        metalness: 0.28,
        transparent: true,
        opacity: 0.88
      });
      const liquidMesh = new THREE.Mesh(liquidGeo, liquidMat);
      liquidMesh.position.y = -0.1;
      bottleGroup.add(liquidMesh);

      // Liquid Material Ref for single mode updates
      if (mode === 'single') {
        liquidMaterialRef.current = liquidMat;
      }

      // Bottle Shoulder Chamfer
      const shoulderGeo = new THREE.CylinderGeometry(0.42, 0.88, 0.35, 32);
      const shoulderMat = new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        metalness: 0.05,
        roughness: 0.05,
        transmission: 0.9,
        transparent: true,
        opacity: 0.92
      });
      const shoulder = new THREE.Mesh(shoulderGeo, shoulderMat);
      shoulder.position.y = 1.5;
      bottleGroup.add(shoulder);

      // Champagne Gold Neck Collar
      const collarGeo = new THREE.CylinderGeometry(0.32, 0.34, 0.38, 32);
      const goldMat = new THREE.MeshStandardMaterial({
        color: 0xd4af37,
        metalness: 0.95,
        roughness: 0.18
      });
      const collar = new THREE.Mesh(collarGeo, goldMat);
      collar.position.y = 1.82;
      bottleGroup.add(collar);

      // Atomizer Spray Nozzle
      const nozzleGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.3, 24);
      const nozzle = new THREE.Mesh(nozzleGeo, goldMat);
      nozzle.position.y = 2.05;
      bottleGroup.add(nozzle);

      // Heavy Faceted Magnetic Cap (Obsidian / Black Gold)
      const capGeo = new THREE.CylinderGeometry(0.72, 0.72, 0.95, 8); // Octagonal luxury cut
      const capMat = new THREE.MeshStandardMaterial({
        color: 0x111116,
        metalness: 0.9,
        roughness: 0.22
      });
      const cap = new THREE.Mesh(capGeo, capMat);
      cap.position.y = 2.45;
      bottleGroup.add(cap);

      // Gold Trim Ring on Cap
      const capRingGeo = new THREE.TorusGeometry(0.725, 0.03, 16, 32);
      const capRing = new THREE.Mesh(capRingGeo, goldMat);
      capRing.rotation.x = Math.PI / 2;
      capRing.position.y = 2.02;
      bottleGroup.add(capRing);

      // Metallic Brand Plate
      const plateGeo = new THREE.PlaneGeometry(1.0, 1.4);
      const plateMat = new THREE.MeshStandardMaterial({
        color: 0x08080a,
        metalness: 0.6,
        roughness: 0.3,
        side: THREE.DoubleSide
      });
      const plate = new THREE.Mesh(plateGeo, plateMat);
      plate.position.set(0, 0, 0.89);
      bottleGroup.add(plate);

      // Gold Border around plate
      const borderGeo = new THREE.PlaneGeometry(1.05, 1.45);
      const borderMat = new THREE.MeshStandardMaterial({
        color: 0xd4af37,
        metalness: 0.95,
        roughness: 0.2
      });
      const border = new THREE.Mesh(borderGeo, borderMat);
      border.position.set(0, 0, 0.885);
      bottleGroup.add(border);

      return bottleGroup;
    };

    // Root Group
    const masterGroup = new THREE.Group();
    scene.add(masterGroup);
    bottlesGroupRef.current = masterGroup;

    if (mode === 'single') {
      const singleBottle = createBottle(MILD_GOLD_LIQUID_HEX, fragranceName);
      masterGroup.add(singleBottle);
    } else {
      // ALL SIX BOTTLES DISPLAY
      FRAGRANCE_PALETTES.forEach((frag, idx) => {
        const bottle = createBottle(frag.color, frag.name);
        const angle = (idx / (FRAGRANCE_PALETTES.length - 1) - 0.5) * 1.5;
        const radius = 3.6;
        bottle.position.x = Math.sin(angle) * radius;
        bottle.position.z = -Math.cos(angle) * 1.2 + 0.5;
        bottle.position.y = (idx % 2 === 0 ? 0.1 : -0.1) * 0.4;
        bottle.rotation.y = -angle * 0.7;
        bottle.scale.set(0.68, 0.68, 0.68);
        masterGroup.add(bottle);
      });
    }

    // Atmospheric Floating Dust Particles
    const particleCount = 180;
    const particleGeo = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount * 3; i += 3) {
      particlePositions[i] = (Math.random() - 0.5) * 10;
      particlePositions[i + 1] = (Math.random() - 0.5) * 8;
      particlePositions[i + 2] = (Math.random() - 0.5) * 6;
    }
    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    const particleMat = new THREE.PointsMaterial({
      color: 0xd4af37,
      size: 0.05,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending
    });
    const particles = new THREE.Points(particleGeo, particleMat);
    scene.add(particles);
    particlesRef.current = particles;

    // Pointer Interaction Handling
    const handlePointerMove = (e: MouseEvent) => {
      if (!interactive) return;
      const rect = container.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
      mousePos.current = { x, y };
      targetRotation.current = {
        y: x * 0.45,
        x: -y * 0.25
      };
    };

    if (interactive) {
      window.addEventListener('mousemove', handlePointerMove);
    }

    // Resize Handler
    const handleResize = () => {
      if (!container) return;
      const newW = container.clientWidth;
      const newH = container.clientHeight;
      camera.aspect = newW / newH;
      camera.updateProjectionMatrix();
      renderer.setSize(newW, newH);
    };

    window.addEventListener('resize', handleResize);

    // Animation Loop with IntersectionObserver off-screen pause & prefers-reduced-motion support
    let animationFrameId: number;
    let isVisible = true;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const clock = new THREE.Clock();

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          isVisible = entry.isIntersecting;
        });
      },
      { threshold: 0.05 }
    );
    observer.observe(container);

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      if (!isVisible) return;

      const elapsedTime = clock.getElapsedTime();

      if (masterGroup) {
        masterGroup.rotation.y += (targetRotation.current.y - masterGroup.rotation.y) * 0.06;
        masterGroup.rotation.x += (targetRotation.current.x - masterGroup.rotation.x) * 0.06;

        if (!prefersReducedMotion) {
          masterGroup.position.y = Math.sin(elapsedTime * 1.2) * 0.08;
        }
      }

      if (particles && !prefersReducedMotion) {
        particles.rotation.y = elapsedTime * 0.03;
        particles.rotation.x = Math.sin(elapsedTime * 0.02) * 0.1;
      }

      renderer.render(scene, camera);
    };

    animate();

    // Cleanup
    return () => {
      cancelAnimationFrame(animationFrameId);
      observer.disconnect();
      window.removeEventListener('resize', handleResize);
      if (interactive) {
        window.removeEventListener('mousemove', handlePointerMove);
      }
      if (container && renderer.domElement) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [mode, interactive]);

  // Keep 3D bottle liquid in consistent mild gold across fragrance transitions
  useEffect(() => {
    if (liquidMaterialRef.current && mode === 'single') {
      liquidMaterialRef.current.color.setHex(MILD_GOLD_LIQUID_HEX);
    }
  }, [color, mode]);

  return (
    <div className={`relative flex items-center justify-center pointer-events-auto ${className}`}>
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
};
