// Instant & Live India Post PIN Code -> City & State Detector

const EXACT_PREFIX_3_MAP: Record<string, { city: string; state: string }> = {
  // Delhi NCR
  '110': { city: 'New Delhi', state: 'Delhi' },
  '121': { city: 'Faridabad', state: 'Haryana' },
  '122': { city: 'Gurugram', state: 'Haryana' },
  '123': { city: 'Rewari', state: 'Haryana' },
  '124': { city: 'Rohtak', state: 'Haryana' },
  '125': { city: 'Hisar', state: 'Haryana' },
  '126': { city: 'Jind', state: 'Haryana' },
  '127': { city: 'Bhiwani', state: 'Haryana' },
  '131': { city: 'Sonipat', state: 'Haryana' },
  '132': { city: 'Karnal', state: 'Haryana' },
  '133': { city: 'Ambala', state: 'Haryana' },
  '134': { city: 'Panchkula', state: 'Haryana' },
  '135': { city: 'Yamunanagar', state: 'Haryana' },
  '136': { city: 'Kurukshetra', state: 'Haryana' },

  // Punjab & Chandigarh
  '140': { city: 'Mohali', state: 'Punjab' },
  '141': { city: 'Ludhiana', state: 'Punjab' },
  '142': { city: 'Moga', state: 'Punjab' },
  '143': { city: 'Amritsar', state: 'Punjab' },
  '144': { city: 'Jalandhar', state: 'Punjab' },
  '145': { city: 'Pathankot', state: 'Punjab' },
  '146': { city: 'Hoshiarpur', state: 'Punjab' },
  '147': { city: 'Patiala', state: 'Punjab' },
  '148': { city: 'Sangrur', state: 'Punjab' },
  '151': { city: 'Bathinda', state: 'Punjab' },
  '152': { city: 'Firozpur', state: 'Punjab' },
  '160': { city: 'Chandigarh', state: 'Chandigarh' },

  // Himachal Pradesh & J&K
  '171': { city: 'Shimla', state: 'Himachal Pradesh' },
  '172': { city: 'Kinnaur', state: 'Himachal Pradesh' },
  '173': { city: 'Solan', state: 'Himachal Pradesh' },
  '174': { city: 'Bilaspur', state: 'Himachal Pradesh' },
  '175': { city: 'Mandi', state: 'Himachal Pradesh' },
  '176': { city: 'Dharamshala', state: 'Himachal Pradesh' },
  '177': { city: 'Hamirpur', state: 'Himachal Pradesh' },
  '180': { city: 'Jammu', state: 'Jammu & Kashmir' },
  '181': { city: 'Jammu', state: 'Jammu & Kashmir' },
  '182': { city: 'Udhampur', state: 'Jammu & Kashmir' },
  '190': { city: 'Srinagar', state: 'Jammu & Kashmir' },
  '191': { city: 'Srinagar', state: 'Jammu & Kashmir' },
  '192': { city: 'Anantnag', state: 'Jammu & Kashmir' },
  '193': { city: 'Baramulla', state: 'Jammu & Kashmir' },
  '194': { city: 'Leh', state: 'Ladakh' },

  // Uttar Pradesh & Uttarakhand
  '201': { city: 'Noida / Ghaziabad', state: 'Uttar Pradesh' },
  '202': { city: 'Aligarh', state: 'Uttar Pradesh' },
  '203': { city: 'Bulandshahr', state: 'Uttar Pradesh' },
  '208': { city: 'Kanpur', state: 'Uttar Pradesh' },
  '211': { city: 'Prayagraj', state: 'Uttar Pradesh' },
  '221': { city: 'Varanasi', state: 'Uttar Pradesh' },
  '226': { city: 'Lucknow', state: 'Uttar Pradesh' },
  '243': { city: 'Bareilly', state: 'Uttar Pradesh' },
  '244': { city: 'Moradabad', state: 'Uttar Pradesh' },
  '247': { city: 'Saharanpur', state: 'Uttar Pradesh' },
  '248': { city: 'Dehradun', state: 'Uttarakhand' },
  '249': { city: 'Haridwar / Rishikesh', state: 'Uttarakhand' },
  '250': { city: 'Meerut', state: 'Uttar Pradesh' },
  '263': { city: 'Nainital / Haldwani', state: 'Uttarakhand' },
  '273': { city: 'Gorakhpur', state: 'Uttar Pradesh' },
  '281': { city: 'Mathura', state: 'Uttar Pradesh' },
  '282': { city: 'Agra', state: 'Uttar Pradesh' },
  '284': { city: 'Jhansi', state: 'Uttar Pradesh' },

  // Rajasthan
  '301': { city: 'Alwar', state: 'Rajasthan' },
  '302': { city: 'Jaipur', state: 'Rajasthan' },
  '303': { city: 'Jaipur', state: 'Rajasthan' },
  '305': { city: 'Ajmer', state: 'Rajasthan' },
  '311': { city: 'Bhilwara', state: 'Rajasthan' },
  '313': { city: 'Udaipur', state: 'Rajasthan' },
  '321': { city: 'Bharatpur', state: 'Rajasthan' },
  '324': { city: 'Kota', state: 'Rajasthan' },
  '332': { city: 'Sikar', state: 'Rajasthan' },
  '334': { city: 'Bikaner', state: 'Rajasthan' },
  '335': { city: 'Sri Ganganagar', state: 'Rajasthan' },
  '342': { city: 'Jodhpur', state: 'Rajasthan' },
  '345': { city: 'Jaisalmer', state: 'Rajasthan' },

  // Gujarat
  '360': { city: 'Rajkot', state: 'Gujarat' },
  '361': { city: 'Jamnagar', state: 'Gujarat' },
  '362': { city: 'Junagadh', state: 'Gujarat' },
  '364': { city: 'Bhavnagar', state: 'Gujarat' },
  '370': { city: 'Bhuj / Kutch', state: 'Gujarat' },
  '380': { city: 'Ahmedabad', state: 'Gujarat' },
  '382': { city: 'Gandhinagar', state: 'Gujarat' },
  '384': { city: 'Mehsana', state: 'Gujarat' },
  '387': { city: 'Nadiad', state: 'Gujarat' },
  '388': { city: 'Anand', state: 'Gujarat' },
  '390': { city: 'Vadodara', state: 'Gujarat' },
  '391': { city: 'Vadodara', state: 'Gujarat' },
  '392': { city: 'Bharuch', state: 'Gujarat' },
  '395': { city: 'Surat', state: 'Gujarat' },
  '396': { city: 'Valsad / Vapi', state: 'Gujarat' },

  // Maharashtra & Goa
  '400': { city: 'Mumbai', state: 'Maharashtra' },
  '401': { city: 'Thane / Palghar', state: 'Maharashtra' },
  '402': { city: 'Raigad / Alibag', state: 'Maharashtra' },
  '403': { city: 'Panaji', state: 'Goa' },
  '410': { city: 'Navi Mumbai / Lonavala', state: 'Maharashtra' },
  '411': { city: 'Pune', state: 'Maharashtra' },
  '412': { city: 'Pune', state: 'Maharashtra' },
  '413': { city: 'Solapur', state: 'Maharashtra' },
  '414': { city: 'Ahmednagar', state: 'Maharashtra' },
  '415': { city: 'Satara / Ratnagiri', state: 'Maharashtra' },
  '416': { city: 'Kolhapur / Sangli', state: 'Maharashtra' },
  '421': { city: 'Kalyan / Dombivli', state: 'Maharashtra' },
  '422': { city: 'Nashik', state: 'Maharashtra' },
  '424': { city: 'Dhule', state: 'Maharashtra' },
  '425': { city: 'Jalgaon', state: 'Maharashtra' },
  '431': { city: 'Chhatrapati Sambhajinagar', state: 'Maharashtra' },
  '440': { city: 'Nagpur', state: 'Maharashtra' },
  '441': { city: 'Nagpur', state: 'Maharashtra' },
  '442': { city: 'Wardha / Chandrapur', state: 'Maharashtra' },
  '444': { city: 'Akola / Amravati', state: 'Maharashtra' },

  // Madhya Pradesh & Chhattisgarh
  '452': { city: 'Indore', state: 'Madhya Pradesh' },
  '453': { city: 'Indore', state: 'Madhya Pradesh' },
  '456': { city: 'Ujjain', state: 'Madhya Pradesh' },
  '462': { city: 'Bhopal', state: 'Madhya Pradesh' },
  '464': { city: 'Vidisha', state: 'Madhya Pradesh' },
  '474': { city: 'Gwalior', state: 'Madhya Pradesh' },
  '482': { city: 'Jabalpur', state: 'Madhya Pradesh' },
  '485': { city: 'Satna', state: 'Madhya Pradesh' },
  '486': { city: 'Rewa', state: 'Madhya Pradesh' },
  '490': { city: 'Bhilai / Durg', state: 'Chhattisgarh' },
  '491': { city: 'Durg', state: 'Chhattisgarh' },
  '492': { city: 'Raipur', state: 'Chhattisgarh' },
  '495': { city: 'Bilaspur', state: 'Chhattisgarh' },

  // Telangana & Andhra Pradesh
  '500': { city: 'Hyderabad', state: 'Telangana' },
  '501': { city: 'Rangareddy', state: 'Telangana' },
  '502': { city: 'Sangareddy / Medak', state: 'Telangana' },
  '503': { city: 'Nizamabad', state: 'Telangana' },
  '505': { city: 'Karimnagar', state: 'Telangana' },
  '506': { city: 'Warangal', state: 'Telangana' },
  '507': { city: 'Khammam', state: 'Telangana' },
  '515': { city: 'Anantapur', state: 'Andhra Pradesh' },
  '516': { city: 'Kadapa', state: 'Andhra Pradesh' },
  '517': { city: 'Tirupati / Chittoor', state: 'Andhra Pradesh' },
  '518': { city: 'Kurnool', state: 'Andhra Pradesh' },
  '520': { city: 'Vijayawada', state: 'Andhra Pradesh' },
  '521': { city: 'Machilipatnam', state: 'Andhra Pradesh' },
  '522': { city: 'Guntur', state: 'Andhra Pradesh' },
  '523': { city: 'Ongole', state: 'Andhra Pradesh' },
  '524': { city: 'Nellore', state: 'Andhra Pradesh' },
  '530': { city: 'Visakhapatnam', state: 'Andhra Pradesh' },
  '531': { city: 'Visakhapatnam', state: 'Andhra Pradesh' },
  '533': { city: 'Kakinada / Rajahmundry', state: 'Andhra Pradesh' },
  '534': { city: 'Eluru / Bhimavaram', state: 'Andhra Pradesh' },
  '535': { city: 'Vizianagaram', state: 'Andhra Pradesh' },

  // Karnataka
  '560': { city: 'Bengaluru', state: 'Karnataka' },
  '561': { city: 'Bengaluru Rural', state: 'Karnataka' },
  '562': { city: 'Chikkaballapur / Ramanagara', state: 'Karnataka' },
  '563': { city: 'Kolar', state: 'Karnataka' },
  '570': { city: 'Mysuru', state: 'Karnataka' },
  '571': { city: 'Mysuru / Mandya', state: 'Karnataka' },
  '572': { city: 'Tumakuru', state: 'Karnataka' },
  '573': { city: 'Hassan', state: 'Karnataka' },
  '574': { city: 'Dakshina Kannada', state: 'Karnataka' },
  '575': { city: 'Mangaluru', state: 'Karnataka' },
  '576': { city: 'Udupi / Manipal', state: 'Karnataka' },
  '577': { city: 'Shivamogga / Davanagere', state: 'Karnataka' },
  '580': { city: 'Hubballi / Dharwad', state: 'Karnataka' },
  '582': { city: 'Gadag', state: 'Karnataka' },
  '583': { city: 'Ballari / Hosapete', state: 'Karnataka' },
  '584': { city: 'Raichur', state: 'Karnataka' },
  '585': { city: 'Kalaburagi / Bidar', state: 'Karnataka' },
  '586': { city: 'Vijayapura', state: 'Karnataka' },
  '587': { city: 'Bagalkot', state: 'Karnataka' },
  '590': { city: 'Belagavi', state: 'Karnataka' },
  '591': { city: 'Belagavi', state: 'Karnataka' },

  // Tamil Nadu & Puducherry
  '600': { city: 'Chennai', state: 'Tamil Nadu' },
  '601': { city: 'Tiruvallur', state: 'Tamil Nadu' },
  '602': { city: 'Kanchipuram', state: 'Tamil Nadu' },
  '603': { city: 'Chengalpattu', state: 'Tamil Nadu' },
  '605': { city: 'Puducherry', state: 'Puducherry' },
  '613': { city: 'Thanjavur', state: 'Tamil Nadu' },
  '620': { city: 'Tiruchirappalli', state: 'Tamil Nadu' },
  '624': { city: 'Dindigul / Kodaikanal', state: 'Tamil Nadu' },
  '625': { city: 'Madurai', state: 'Tamil Nadu' },
  '627': { city: 'Tirunelveli', state: 'Tamil Nadu' },
  '628': { city: 'Thoothukudi', state: 'Tamil Nadu' },
  '629': { city: 'Nagercoil / Kanyakumari', state: 'Tamil Nadu' },
  '632': { city: 'Vellore', state: 'Tamil Nadu' },
  '635': { city: 'Hosur / Krishnagiri', state: 'Tamil Nadu' },
  '636': { city: 'Salem', state: 'Tamil Nadu' },
  '638': { city: 'Erode', state: 'Tamil Nadu' },
  '641': { city: 'Coimbatore / Tiruppur', state: 'Tamil Nadu' },
  '643': { city: 'Udhagamandalam (Ooty)', state: 'Tamil Nadu' },

  // Kerala
  '670': { city: 'Kannur', state: 'Kerala' },
  '671': { city: 'Kasaragod', state: 'Kerala' },
  '673': { city: 'Kozhikode', state: 'Kerala' },
  '676': { city: 'Malappuram', state: 'Kerala' },
  '678': { city: 'Palakkad', state: 'Kerala' },
  '680': { city: 'Thrissur', state: 'Kerala' },
  '682': { city: 'Kochi', state: 'Kerala' },
  '683': { city: 'Ernakulam / Aluva', state: 'Kerala' },
  '686': { city: 'Kottayam', state: 'Kerala' },
  '688': { city: 'Alappuzha', state: 'Kerala' },
  '691': { city: 'Kollam', state: 'Kerala' },
  '695': { city: 'Thiruvananthapuram', state: 'Kerala' },

  // West Bengal, Odisha, Assam & North East
  '700': { city: 'Kolkata', state: 'West Bengal' },
  '711': { city: 'Howrah', state: 'West Bengal' },
  '712': { city: 'Hooghly', state: 'West Bengal' },
  '713': { city: 'Durgapur / Asansol', state: 'West Bengal' },
  '721': { city: 'Kharagpur / Medinipur', state: 'West Bengal' },
  '734': { city: 'Siliguri / Darjeeling', state: 'West Bengal' },
  '744': { city: 'Port Blair', state: 'Andaman & Nicobar Islands' },
  '751': { city: 'Bhubaneswar', state: 'Odisha' },
  '752': { city: 'Puri / Khordha', state: 'Odisha' },
  '753': { city: 'Cuttack', state: 'Odisha' },
  '760': { city: 'Brahmapur', state: 'Odisha' },
  '768': { city: 'Sambalpur', state: 'Odisha' },
  '769': { city: 'Rourkela', state: 'Odisha' },
  '781': { city: 'Guwahati', state: 'Assam' },
  '784': { city: 'Tezpur', state: 'Assam' },
  '785': { city: 'Jorhat', state: 'Assam' },
  '786': { city: 'Dibrugarh / Tinsukia', state: 'Assam' },
  '788': { city: 'Silchar', state: 'Assam' },
  '790': { city: 'Itanagar', state: 'Arunachal Pradesh' },
  '791': { city: 'Itanagar', state: 'Arunachal Pradesh' },
  '793': { city: 'Shillong', state: 'Meghalaya' },
  '795': { city: 'Imphal', state: 'Manipur' },
  '796': { city: 'Aizawl', state: 'Mizoram' },
  '797': { city: 'Kohima / Dimapur', state: 'Nagaland' },
  '799': { city: 'Agartala', state: 'Tripura' },

  // Bihar & Jharkhand
  '800': { city: 'Patna', state: 'Bihar' },
  '801': { city: 'Patna', state: 'Bihar' },
  '812': { city: 'Bhagalpur', state: 'Bihar' },
  '823': { city: 'Gaya', state: 'Bihar' },
  '826': { city: 'Dhanbad', state: 'Jharkhand' },
  '827': { city: 'Bokaro', state: 'Jharkhand' },
  '831': { city: 'Jamshedpur', state: 'Jharkhand' },
  '834': { city: 'Ranchi', state: 'Jharkhand' },
  '842': { city: 'Muzaffarpur', state: 'Bihar' },
  '846': { city: 'Darbhanga', state: 'Bihar' },
  '854': { city: 'Purnia', state: 'Bihar' }
};

const STATE_BY_2_DIGIT_PREFIX: Record<string, { defaultCity: string; state: string }> = {
  '11': { defaultCity: 'New Delhi', state: 'Delhi' },
  '12': { defaultCity: 'Gurugram', state: 'Haryana' },
  '13': { defaultCity: 'Karnal', state: 'Haryana' },
  '14': { defaultCity: 'Ludhiana', state: 'Punjab' },
  '15': { defaultCity: 'Bathinda', state: 'Punjab' },
  '16': { defaultCity: 'Chandigarh', state: 'Chandigarh' },
  '17': { defaultCity: 'Shimla', state: 'Himachal Pradesh' },
  '18': { defaultCity: 'Jammu', state: 'Jammu & Kashmir' },
  '19': { defaultCity: 'Srinagar', state: 'Jammu & Kashmir' },
  '20': { defaultCity: 'Noida', state: 'Uttar Pradesh' },
  '21': { defaultCity: 'Prayagraj', state: 'Uttar Pradesh' },
  '22': { defaultCity: 'Lucknow', state: 'Uttar Pradesh' },
  '23': { defaultCity: 'Mirzapur', state: 'Uttar Pradesh' },
  '24': { defaultCity: 'Dehradun', state: 'Uttarakhand' },
  '25': { defaultCity: 'Meerut', state: 'Uttar Pradesh' },
  '26': { defaultCity: 'Nainital', state: 'Uttarakhand' },
  '27': { defaultCity: 'Gorakhpur', state: 'Uttar Pradesh' },
  '28': { defaultCity: 'Agra', state: 'Uttar Pradesh' },
  '30': { defaultCity: 'Jaipur', state: 'Rajasthan' },
  '31': { defaultCity: 'Udaipur', state: 'Rajasthan' },
  '32': { defaultCity: 'Kota', state: 'Rajasthan' },
  '33': { defaultCity: 'Bikaner', state: 'Rajasthan' },
  '34': { defaultCity: 'Jodhpur', state: 'Rajasthan' },
  '36': { defaultCity: 'Rajkot', state: 'Gujarat' },
  '37': { defaultCity: 'Bhuj', state: 'Gujarat' },
  '38': { defaultCity: 'Ahmedabad', state: 'Gujarat' },
  '39': { defaultCity: 'Surat', state: 'Gujarat' },
  '40': { defaultCity: 'Mumbai', state: 'Maharashtra' },
  '41': { defaultCity: 'Pune', state: 'Maharashtra' },
  '42': { defaultCity: 'Nashik', state: 'Maharashtra' },
  '43': { defaultCity: 'Chhatrapati Sambhajinagar', state: 'Maharashtra' },
  '44': { defaultCity: 'Nagpur', state: 'Maharashtra' },
  '45': { defaultCity: 'Indore', state: 'Madhya Pradesh' },
  '46': { defaultCity: 'Bhopal', state: 'Madhya Pradesh' },
  '47': { defaultCity: 'Gwalior', state: 'Madhya Pradesh' },
  '48': { defaultCity: 'Jabalpur', state: 'Madhya Pradesh' },
  '49': { defaultCity: 'Raipur', state: 'Chhattisgarh' },
  '50': { defaultCity: 'Hyderabad', state: 'Telangana' },
  '51': { defaultCity: 'Tirupati', state: 'Andhra Pradesh' },
  '52': { defaultCity: 'Vijayawada', state: 'Andhra Pradesh' },
  '53': { defaultCity: 'Visakhapatnam', state: 'Andhra Pradesh' },
  '56': { defaultCity: 'Bengaluru', state: 'Karnataka' },
  '57': { defaultCity: 'Mysuru', state: 'Karnataka' },
  '58': { defaultCity: 'Hubballi', state: 'Karnataka' },
  '59': { defaultCity: 'Belagavi', state: 'Karnataka' },
  '60': { defaultCity: 'Chennai', state: 'Tamil Nadu' },
  '61': { defaultCity: 'Thanjavur', state: 'Tamil Nadu' },
  '62': { defaultCity: 'Madurai', state: 'Tamil Nadu' },
  '63': { defaultCity: 'Salem', state: 'Tamil Nadu' },
  '64': { defaultCity: 'Coimbatore', state: 'Tamil Nadu' },
  '67': { defaultCity: 'Kozhikode', state: 'Kerala' },
  '68': { defaultCity: 'Kochi', state: 'Kerala' },
  '69': { defaultCity: 'Thiruvananthapuram', state: 'Kerala' },
  '70': { defaultCity: 'Kolkata', state: 'West Bengal' },
  '71': { defaultCity: 'Howrah', state: 'West Bengal' },
  '72': { defaultCity: 'Medinipur', state: 'West Bengal' },
  '73': { defaultCity: 'Siliguri', state: 'West Bengal' },
  '74': { defaultCity: 'Nadia', state: 'West Bengal' },
  '75': { defaultCity: 'Bhubaneswar', state: 'Odisha' },
  '76': { defaultCity: 'Rourkela', state: 'Odisha' },
  '77': { defaultCity: 'Jharsuguda', state: 'Odisha' },
  '78': { defaultCity: 'Guwahati', state: 'Assam' },
  '79': { defaultCity: 'Shillong', state: 'Meghalaya' },
  '80': { defaultCity: 'Patna', state: 'Bihar' },
  '81': { defaultCity: 'Bhagalpur', state: 'Bihar' },
  '82': { defaultCity: 'Gaya', state: 'Bihar' },
  '83': { defaultCity: 'Ranchi', state: 'Jharkhand' },
  '84': { defaultCity: 'Muzaffarpur', state: 'Bihar' },
  '85': { defaultCity: 'Purnia', state: 'Bihar' }
};

export function lookupPincodeSync(rawPincode: string): { city: string; state: string } | null {
  const clean = (rawPincode || '').replace(/\D/g, '');
  if (clean.length < 3) return null;

  // Special sub-prefixes
  if (clean.startsWith('2013')) return { city: 'Noida', state: 'Uttar Pradesh' };
  if (clean.startsWith('2010')) return { city: 'Ghaziabad', state: 'Uttar Pradesh' };
  if (clean.startsWith('4006')) return { city: 'Thane', state: 'Maharashtra' };
  if (clean.startsWith('4007')) return { city: 'Navi Mumbai', state: 'Maharashtra' };

  const prefix3 = clean.slice(0, 3);
  if (EXACT_PREFIX_3_MAP[prefix3]) {
    return EXACT_PREFIX_3_MAP[prefix3];
  }

  const prefix2 = clean.slice(0, 2);
  if (STATE_BY_2_DIGIT_PREFIX[prefix2]) {
    return {
      city: STATE_BY_2_DIGIT_PREFIX[prefix2].defaultCity,
      state: STATE_BY_2_DIGIT_PREFIX[prefix2].state
    };
  }

  return null;
}

export async function detectCityAndStateFromPincode(
  rawPincode: string,
  onDetected: (result: { city: string; state: string; locality?: string }) => void
): Promise<void> {
  const clean = (rawPincode || '').replace(/\D/g, '');
  if (clean.length < 3) return;

  // 1. Instant synchronous lookup
  const instant = lookupPincodeSync(clean);
  if (instant) {
    onDetected(instant);
  }

  // 2. If full 6-digit PIN code is entered, query official India Post API for exact district & state
  if (clean.length === 6) {
    try {
      const response = await fetch(`https://api.postalpincode.in/pincode/${clean}`);
      if (!response.ok) return;
      const data = await response.json();
      if (
        Array.isArray(data) &&
        data[0]?.Status === 'Success' &&
        Array.isArray(data[0]?.PostOffice) &&
        data[0].PostOffice.length > 0
      ) {
        const po = data[0].PostOffice[0];
        const detectedCity = (po.District || po.Block || po.Division || instant?.city || '').trim();
        const detectedState = (po.State || instant?.state || '').trim();
        if (detectedCity && detectedState) {
          onDetected({
            city: detectedCity,
            state: detectedState,
            locality: po.Name
          });
        }
      }
    } catch {
      // Keep instant synchronous fallback if offline or blocked
    }
  }
}
