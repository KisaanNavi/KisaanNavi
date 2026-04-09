export type Language = 'en' | 'hi' | 'te'

export const translations = {
  en: {
    nav: {
      home: 'Home',
      chat: 'Chat Assistant',
      cropRecommend: 'Crop Recommendation',
      fertilizerRecommend: 'Fertilizer Recommendation',
      weather: 'Weather Advisory',
      login: 'Login',
      register: 'Register',
      logout: 'Logout',
      profile: 'Profile',
      about: 'About'
    },
    hero: {
      title: 'KisaanNavi',
      subtitle: 'AI-Powered Decision Support System for Indian Farmers',
      description: 'Get personalized crop recommendations, fertilizer advice, weather forecasts and expert guidance in your language.',
      startChat: 'Start Chatting',
      exploreCrop: 'Explore Crop Recommendations',
      guestMode: 'Continue as Guest'
    },
    features: {
      title: 'How KisaanNavi Helps You',
      crop: {
        title: 'Crop Recommendation',
        description: 'Get AI-powered suggestions for the best crops based on your soil type, climate, and region.'
      },
      fertilizer: {
        title: 'Fertilizer Recommendation',
        description: 'Know exactly what fertilizers your soil needs based on nutrient analysis.'
      },
      chat: {
        title: 'Smart Assistant',
        description: 'Ask any farming question in your language using text or voice - get instant, reliable answers.'
      }
    },
    weather: {
      title: 'Weather Advisory',
      subtitle: 'Real-time weather updates and forecasts for your region',
      current: 'Current Weather',
      today: 'Today',
      tomorrow: 'Tomorrow',
      sevenDay: '7-Day Forecast',
      temperature: 'Temperature',
      humidity: 'Humidity',
      wind: 'Wind Speed',
      rainfall: 'Rainfall',
      advisory: 'Farming Advisory',
      enterLocation: 'Enter your location',
      search: 'Search',
      feelsLike: 'Feels like',
      uvIndex: 'UV Index',
      visibility: 'Visibility',
      pressure: 'Pressure',
      sunrise: 'Sunrise',
      sunset: 'Sunset',
      cropAdvisory: 'Crop Advisory based on Weather'
    },
    auth: {
      login: 'Login',
      register: 'Register',
      email: 'Email Address',
      password: 'Password',
      confirmPassword: 'Confirm Password',
      name: 'Full Name',
      phone: 'Phone Number',
      state: 'State',
      loginBtn: 'Login',
      registerBtn: 'Create Account',
      noAccount: "Don't have an account?",
      hasAccount: 'Already have an account?',
      orContinueAs: 'Or continue as',
      guest: 'Guest',
      forgotPassword: 'Forgot Password?',
      rememberMe: 'Remember me'
    },
    chat: {
      title: 'Chat with KisaanNavi',
      placeholder: 'Type your question here or use voice...',
      send: 'Send',
      listening: 'Listening...',
      voiceBtn: 'Voice Input',
      welcome: 'Namaste! I am KisaanNavi, your farming assistant. Ask me anything about crops, fertilizers, weather, or farming practices!',
      thinking: 'Thinking...',
      welcomeBack: 'Welcome back!',
      lastVisit: 'Last visited',
      continueBtn: 'Continue where you left',
      newChat: 'Start fresh'
    },
    cropRec: {
      title: 'Crop Recommendation',
      subtitle: 'Enter your soil and climate details to get the best crop suggestions',
      nitrogen: 'Nitrogen (N) kg/ha',
      phosphorus: 'Phosphorus (P) kg/ha',
      potassium: 'Potassium (K) kg/ha',
      temperature: 'Temperature (°C)',
      humidity: 'Humidity (%)',
      ph: 'pH Level',
      rainfall: 'Rainfall (mm)',
      state: 'State',
      season: 'Season',
      submit: 'Get Recommendations',
      result: 'Recommended Crops',
      seasons: {
        kharif: 'Kharif (Monsoon)',
        rabi: 'Rabi (Winter)',
        zaid: 'Zaid (Summer)'
      }
    },
    fertRec: {
      title: 'Fertilizer Recommendation',
      subtitle: 'Get personalized fertilizer suggestions based on your soil and crop',
      soilType: 'Soil Type',
      cropType: 'Crop Type',
      nitrogen: 'Nitrogen Level',
      phosphorus: 'Phosphorus Level',
      potassium: 'Potassium Level',
      submit: 'Get Fertilizer Advice',
      result: 'Recommended Fertilizers',
      levels: { low: 'Low', medium: 'Medium', high: 'High' },
      soilTypes: { sandy: 'Sandy', loamy: 'Loamy', black: 'Black', red: 'Red', clayey: 'Clayey' }
    },
    common: {
      loading: 'Loading...',
      error: 'Something went wrong',
      back: 'Back',
      selectLanguage: 'Select Language'
    },
    footer: {
      tagline: 'Empowering Indian Farmers with AI',
      madeWith: 'Made with ❤️ for Indian Farmers',
      college: 'College Major Project - 8th Semester'
    }
  },
  hi: {
    nav: {
      home: 'होम',
      chat: 'चैट सहायक',
      cropRecommend: 'फसल सुझाव',
      fertilizerRecommend: 'उर्वरक सुझाव',
      weather: 'मौसम सलाह',
      login: 'लॉगिन',
      register: 'रजिस्टर',
      logout: 'लॉगआउट',
      profile: 'प्रोफाइल',
      about: 'हमारे बारे में'
    },
    hero: {
      title: 'किसानNavi',
      subtitle: 'भारतीय किसानों के लिए AI-संचालित निर्णय सहायता प्रणाली',
      description: 'अपनी भाषा में व्यक्तिगत फसल सिफारिशें, उर्वरक सलाह, मौसम पूर्वानुमान और विशेषज्ञ मार्गदर्शन प्राप्त करें।',
      startChat: 'चैट शुरू करें',
      exploreCrop: 'फसल सुझाव देखें',
      guestMode: 'अतिथि के रूप में जारी रखें'
    },
    features: {
      title: 'किसानNavi आपकी कैसे मदद करता है',
      crop: {
        title: 'फसल सुझाव',
        description: 'अपनी मिट्टी, जलवायु और क्षेत्र के आधार पर सर्वोत्तम फसलों के लिए AI-संचालित सुझाव प्राप्त करें।'
      },
      fertilizer: {
        title: 'उर्वरक सुझाव',
        description: 'पोषक तत्व विश्लेषण के आधार पर जानें कि आपकी मिट्टी को किस उर्वरक की आवश्यकता है।'
      },
      chat: {
        title: 'स्मार्ट सहायक',
        description: 'टेक्स्ट या आवाज का उपयोग करके अपनी भाषा में कोई भी कृषि प्रश्न पूछें - तुरंत, विश्वसनीय उत्तर प्राप्त करें।'
      }
    },
    weather: {
      title: 'मौसम सलाह',
      subtitle: 'आपके क्षेत्र के लिए वास्तविक समय मौसम अपडेट और पूर्वानुमान',
      current: 'वर्तमान मौसम',
      today: 'आज',
      tomorrow: 'कल',
      sevenDay: '7-दिन का पूर्वानुमान',
      temperature: 'तापमान',
      humidity: 'आर्द्रता',
      wind: 'हवा की गति',
      rainfall: 'वर्षा',
      advisory: 'कृषि सलाह',
      enterLocation: 'अपना स्थान दर्ज करें',
      search: 'खोजें',
      feelsLike: 'महसूस हो रहा है',
      uvIndex: 'UV सूचकांक',
      visibility: 'दृश्यता',
      pressure: 'दबाव',
      sunrise: 'सूर्योदय',
      sunset: 'सूर्यास्त',
      cropAdvisory: 'मौसम के आधार पर फसल सलाह'
    },
    auth: {
      login: 'लॉगिन',
      register: 'रजिस्टर',
      email: 'ईमेल पता',
      password: 'पासवर्ड',
      confirmPassword: 'पासवर्ड की पुष्टि करें',
      name: 'पूरा नाम',
      phone: 'फोन नंबर',
      state: 'राज्य',
      loginBtn: 'लॉगिन',
      registerBtn: 'खाता बनाएं',
      noAccount: 'खाता नहीं है?',
      hasAccount: 'पहले से खाता है?',
      orContinueAs: 'या इस रूप में जारी रखें',
      guest: 'अतिथि',
      forgotPassword: 'पासवर्ड भूल गए?',
      rememberMe: 'मुझे याद रखें'
    },
    chat: {
      title: 'किसानNavi से बात करें',
      placeholder: 'यहाँ अपना प्रश्न लिखें या आवाज का उपयोग करें...',
      send: 'भेजें',
      listening: 'सुन रहा हूँ...',
      voiceBtn: 'आवाज इनपुट',
      welcome: 'नमस्ते! मैं किसानNavi हूँ, आपका कृषि सहायक। फसलों, उर्वरकों, मौसम या कृषि पद्धतियों के बारे में कुछ भी पूछें!',
      thinking: 'सोच रहा हूँ...',
      welcomeBack: 'वापस स्वागत है!',
      lastVisit: 'पिछली बार आए थे',
      continueBtn: 'जहाँ छोड़ा था वहाँ से जारी रखें',
      newChat: 'नई शुरुआत'
    },
    cropRec: {
      title: 'फसल सुझाव',
      subtitle: 'सर्वोत्तम फसल सुझाव प्राप्त करने के लिए अपनी मिट्टी और जलवायु विवरण दर्ज करें',
      nitrogen: 'नाइट्रोजन (N) किग्रा/हेक्टेयर',
      phosphorus: 'फास्फोरस (P) किग्रा/हेक्टेयर',
      potassium: 'पोटेशियम (K) किग्रा/हेक्टेयर',
      temperature: 'तापमान (°C)',
      humidity: 'आर्द्रता (%)',
      ph: 'pH स्तर',
      rainfall: 'वर्षा (मिमी)',
      state: 'राज्य',
      season: 'मौसम',
      submit: 'सुझाव प्राप्त करें',
      result: 'अनुशंसित फसलें',
      seasons: { kharif: 'खरीफ (मानसून)', rabi: 'रबी (सर्दी)', zaid: 'जायद (गर्मी)' }
    },
    fertRec: {
      title: 'उर्वरक सुझाव',
      subtitle: 'अपनी मिट्टी और फसल के आधार पर व्यक्तिगत उर्वरक सुझाव प्राप्त करें',
      soilType: 'मिट्टी का प्रकार',
      cropType: 'फसल का प्रकार',
      nitrogen: 'नाइट्रोजन स्तर',
      phosphorus: 'फास्फोरस स्तर',
      potassium: 'पोटेशियम स्तर',
      submit: 'उर्वरक सलाह प्राप्त करें',
      result: 'अनुशंसित उर्वरक',
      levels: { low: 'कम', medium: 'मध्यम', high: 'अधिक' },
      soilTypes: { sandy: 'रेतीली', loamy: 'दोमट', black: 'काली', red: 'लाल', clayey: 'चिकनी' }
    },
    common: {
      loading: 'लोड हो रहा है...',
      error: 'कुछ गलत हो गया',
      back: 'वापस',
      selectLanguage: 'भाषा चुनें'
    },
    footer: {
      tagline: 'AI से भारतीय किसानों को सशक्त बनाना',
      madeWith: 'भारतीय किसानों के लिए ❤️ से बनाया गया',
      college: 'कॉलेज मेजर प्रोजेक्ट - 8वां सेमेस्टर'
    }
  },
  te: {
    nav: {
      home: 'హోమ్',
      chat: 'చాట్ సహాయకుడు',
      cropRecommend: 'పంట సిఫార్సు',
      fertilizerRecommend: 'ఎరువుల సిఫార్సు',
      weather: 'వాతావరణ సలహా',
      login: 'లాగిన్',
      register: 'రిజిస్టర్',
      logout: 'లాగౌట్',
      profile: 'ప్రొఫైల్',
      about: 'మా గురించి'
    },
    hero: {
      title: 'కిసాన్Navi',
      subtitle: 'భారతీయ రైతుల కోసం AI-ఆధారిత నిర్ణయ మద్దతు వ్యవస్థ',
      description: 'మీ భాషలో వ్యక్తిగతీకరించిన పంట సిఫార్సులు, ఎరువుల సలహా, వాతావరణ అంచనాలు పొందండి.',
      startChat: 'చాట్ ప్రారంభించండి',
      exploreCrop: 'పంట సిఫార్సులు అన్వేషించండి',
      guestMode: 'అతిథిగా కొనసాగించండి'
    },
    features: {
      title: 'కిసాన్Navi మీకు ఎలా సహాయపడుతుంది',
      crop: {
        title: 'పంట సిఫార్సు',
        description: 'మీ నేల రకం, వాతావరణం ఆధారంగా ఉత్తమ పంటల కోసం AI-ఆధారిత సూచనలు పొందండి.'
      },
      fertilizer: {
        title: 'ఎరువుల సిఫార్సు',
        description: 'పోషక విశ్లేషణ ఆధారంగా మీ నేలకు ఏ ఎరువులు అవసరమో తెలుసుకోండి.'
      },
      chat: {
        title: 'స్మార్ట్ సహాయకుడు',
        description: 'టెక్స్ట్ లేదా వాయిస్ ఉపయోగించి మీ భాషలో ఏదైనా వ్యవసాయ ప్రశ్న అడగండి.'
      }
    },
    weather: {
      title: 'వాతావరణ సలహా',
      subtitle: 'మీ ప్రాంతానికి నిజ-సమయ వాతావరణ నవీకరణలు',
      current: 'ప్రస్తుత వాతావరణం',
      today: 'ఈరోజు',
      tomorrow: 'రేపు',
      sevenDay: '7-రోజుల అంచనా',
      temperature: 'ఉష్ణోగ్రత',
      humidity: 'తేమ',
      wind: 'గాలి వేగం',
      rainfall: 'వర్షపాతం',
      advisory: 'వ్యవసాయ సలహా',
      enterLocation: 'మీ స్థానాన్ని నమోదు చేయండి',
      search: 'శోధన',
      feelsLike: 'అనిపిస్తుంది',
      uvIndex: 'UV సూచిక',
      visibility: 'దృశ్యమానత',
      pressure: 'పీడనం',
      sunrise: 'సూర్యోదయం',
      sunset: 'సూర్యాస్తమయం',
      cropAdvisory: 'వాతావరణం ఆధారంగా పంట సలహా'
    },
    auth: {
      login: 'లాగిన్',
      register: 'రిజిస్టర్',
      email: 'ఇమెయిల్ చిరునామా',
      password: 'పాస్‌వర్డ్',
      confirmPassword: 'పాస్‌వర్డ్ నిర్ధారించండి',
      name: 'పూర్తి పేరు',
      phone: 'ఫోన్ నంబర్',
      state: 'రాష్ట్రం',
      loginBtn: 'లాగిన్',
      registerBtn: 'ఖాతా సృష్టించండి',
      noAccount: 'ఖాతా లేదా?',
      hasAccount: 'ఇప్పటికే ఖాతా ఉందా?',
      orContinueAs: 'లేదా ఇలా కొనసాగించండి',
      guest: 'అతిథి',
      forgotPassword: 'పాస్‌వర్డ్ మర్చిపోయారా?',
      rememberMe: 'నన్ను గుర్తుంచుకో'
    },
    chat: {
      title: 'కిసాన్Naviతో మాట్లాడండి',
      placeholder: 'మీ ప్రశ్నను ఇక్కడ టైప్ చేయండి లేదా వాయిస్ ఉపయోగించండి...',
      send: 'పంపండి',
      listening: 'వింటున్నాను...',
      voiceBtn: 'వాయిస్ ఇన్‌పుట్',
      welcome: 'నమస్కారం! నేను కిసాన్Navi, మీ వ్యవసాయ సహాయకుడిని. పంటలు, ఎరువులు, వాతావరణం గురించి ఏదైనా అడగండి!',
      thinking: 'ఆలోచిస్తున్నాను...',
      welcomeBack: 'తిరిగి స్వాగతం!',
      lastVisit: 'చివరిసారి సందర్శించారు',
      continueBtn: 'మీరు వదిలిన చోటు నుండి కొనసాగించండి',
      newChat: 'కొత్తగా ప్రారంభించండి'
    },
    cropRec: {
      title: 'పంట సిఫార్సు',
      subtitle: 'ఉత్తమ పంట సూచనలు పొందడానికి మీ నేల వివరాలను నమోదు చేయండి',
      nitrogen: 'నత్రజని (N) కిలో/హెక్టార్',
      phosphorus: 'భాస్వరం (P) కిలో/హెక్టార్',
      potassium: 'పొటాషియం (K) కిలో/హెక్టార్',
      temperature: 'ఉష్ణోగ్రత (°C)',
      humidity: 'తేమ (%)',
      ph: 'pH స్థాయి',
      rainfall: 'వర్షపాతం (మిమీ)',
      state: 'రాష్ట్రం',
      season: 'సీజన్',
      submit: 'సిఫార్సులు పొందండి',
      result: 'సిఫార్సు చేసిన పంటలు',
      seasons: { kharif: 'ఖరీఫ్ (వర్షాకాలం)', rabi: 'రబీ (శీతాకాలం)', zaid: 'జైద్ (వేసవి)' }
    },
    fertRec: {
      title: 'ఎరువుల సిఫార్సు',
      subtitle: 'మీ నేల మరియు పంట ఆధారంగా ఎరువుల సూచనలు పొందండి',
      soilType: 'నేల రకం',
      cropType: 'పంట రకం',
      nitrogen: 'నత్రజని స్థాయి',
      phosphorus: 'భాస్వరం స్థాయి',
      potassium: 'పొటాషియం స్థాయి',
      submit: 'ఎరువుల సలహా పొందండి',
      result: 'సిఫార్సు చేసిన ఎరువులు',
      levels: { low: 'తక్కువ', medium: 'మధ్యస్థం', high: 'ఎక్కువ' },
      soilTypes: { sandy: 'ఇసుక', loamy: 'గరుకు', black: 'నల్ల', red: 'ఎరుపు', clayey: 'బంక' }
    },
    common: {
      loading: 'లోడ్ అవుతోంది...',
      error: 'ఏదో తప్పు జరిగింది',
      back: 'వెనుకకు',
      selectLanguage: 'భాషను ఎంచుకోండి'
    },
    footer: {
      tagline: 'AIతో భారతీయ రైతులను శక్తివంతం చేయడం',
      madeWith: 'భారతీయ రైతుల కోసం ❤️తో తయారు చేయబడింది',
      college: 'కళాశాల మేజర్ ప్రాజెక్ట్ - 8వ సెమిస్టర్'
    }
  }
}

export const languageNames: Record<Language, string> = {
  en: 'English',
  hi: 'हिंदी',
  te: 'తెలుగు'
}