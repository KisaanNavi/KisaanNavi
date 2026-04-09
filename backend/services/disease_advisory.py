from __future__ import annotations


LABEL_DETAILS = {
    "Apple Scab Leaf": {"crop": "Apple", "disease": "Apple scab", "healthy": False},
    "Apple leaf": {"crop": "Apple", "disease": "Healthy leaf", "healthy": True},
    "Apple rust leaf": {"crop": "Apple", "disease": "Cedar apple rust", "healthy": False},
    "Bell_pepper leaf": {"crop": "Bell pepper", "disease": "Healthy leaf", "healthy": True},
    "Bell_pepper leaf spot": {"crop": "Bell pepper", "disease": "Bacterial leaf spot", "healthy": False},
    "Blueberry leaf": {"crop": "Blueberry", "disease": "Healthy leaf", "healthy": True},
    "Cherry leaf": {"crop": "Cherry", "disease": "Healthy leaf", "healthy": True},
    "Corn Gray leaf spot": {"crop": "Corn", "disease": "Gray leaf spot", "healthy": False},
    "Corn leaf blight": {"crop": "Corn", "disease": "Northern leaf blight", "healthy": False},
    "Corn rust leaf": {"crop": "Corn", "disease": "Common rust", "healthy": False},
    "Peach leaf": {"crop": "Peach", "disease": "Healthy leaf", "healthy": True},
    "Potato leaf": {"crop": "Potato", "disease": "Healthy leaf", "healthy": True},
    "Potato leaf early blight": {"crop": "Potato", "disease": "Early blight", "healthy": False},
    "Potato leaf late blight": {"crop": "Potato", "disease": "Late blight", "healthy": False},
    "Raspberry leaf": {"crop": "Raspberry", "disease": "Healthy leaf", "healthy": True},
    "Soyabean leaf": {"crop": "Soybean", "disease": "Healthy leaf", "healthy": True},
    "Soybean leaf": {"crop": "Soybean", "disease": "Healthy leaf", "healthy": True},
    "Squash Powdery mildew leaf": {"crop": "Squash", "disease": "Powdery mildew", "healthy": False},
    "Strawberry leaf": {"crop": "Strawberry", "disease": "Healthy leaf", "healthy": True},
    "Tomato Early blight leaf": {"crop": "Tomato", "disease": "Early blight", "healthy": False},
    "Tomato Septoria leaf spot": {"crop": "Tomato", "disease": "Septoria leaf spot", "healthy": False},
    "Tomato leaf": {"crop": "Tomato", "disease": "Healthy leaf", "healthy": True},
    "Tomato leaf bacterial spot": {"crop": "Tomato", "disease": "Bacterial spot", "healthy": False},
    "Tomato leaf late blight": {"crop": "Tomato", "disease": "Late blight", "healthy": False},
    "Tomato leaf mosaic virus": {"crop": "Tomato", "disease": "Mosaic virus", "healthy": False},
    "Tomato leaf yellow virus": {"crop": "Tomato", "disease": "Yellow leaf curl virus", "healthy": False},
    "Tomato mold leaf": {"crop": "Tomato", "disease": "Leaf mold", "healthy": False},
    "Tomato two spotted spider mites leaf": {"crop": "Tomato", "disease": "Two spotted spider mites", "healthy": False},
    "grape leaf": {"crop": "Grape", "disease": "Healthy leaf", "healthy": True},
    "grape leaf black rot": {"crop": "Grape", "disease": "Black rot", "healthy": False},
}


DISEASE_GUIDANCE = {
    "apple scab": {
        "summary": "Apple scab causes olive to dark lesions and can reduce fruit quality if it spreads.",
        "immediate_actions": [
            "Remove heavily infected leaves from the orchard floor.",
            "Avoid overhead irrigation during late evening hours.",
            "Use a recommended fungicide schedule from your local extension officer."
        ],
        "prevention_tips": [
            "Prune for better air circulation.",
            "Sanitize fallen leaves after harvest.",
            "Prefer resistant apple varieties where possible."
        ],
    },
    "cedar apple rust": {
        "summary": "Rust infections spread in humid weather and often show orange or rust-colored leaf spots.",
        "immediate_actions": [
            "Remove infected leaves if incidence is localized.",
            "Monitor nearby alternate host plants such as junipers.",
            "Use crop-safe fungicide advice from your local horticulture office."
        ],
        "prevention_tips": [
            "Improve airflow in the canopy.",
            "Avoid keeping alternate hosts near the orchard.",
            "Inspect young leaves early in the season."
        ],
    },
    "bacterial leaf spot": {
        "summary": "Bacterial leaf spot spreads quickly in warm, wet conditions and can scar leaves and fruits.",
        "immediate_actions": [
            "Avoid handling wet plants to reduce spread.",
            "Remove badly infected leaves from the field.",
            "Use a copper-based control only if locally recommended."
        ],
        "prevention_tips": [
            "Use clean seed or seedlings.",
            "Avoid overhead irrigation when possible.",
            "Rotate with non-host crops."
        ],
    },
    "gray leaf spot": {
        "summary": "Gray leaf spot in corn reduces photosynthesis and can cut yield under humid conditions.",
        "immediate_actions": [
            "Scout neighboring plants to estimate spread.",
            "Avoid excess late nitrogen if crop is already stressed.",
            "Use fungicide only when disease pressure and crop stage justify it."
        ],
        "prevention_tips": [
            "Rotate with non-cereal crops.",
            "Manage residue after harvest.",
            "Choose tolerant hybrids when available."
        ],
    },
    "northern leaf blight": {
        "summary": "Northern leaf blight creates long cigar-shaped lesions and can spread rapidly after rains.",
        "immediate_actions": [
            "Monitor upper canopy leaves for fresh lesions.",
            "Keep the field free from unnecessary moisture stress.",
            "Discuss fungicide need based on crop stage and severity."
        ],
        "prevention_tips": [
            "Use tolerant varieties.",
            "Rotate crops and manage residue.",
            "Avoid dense planting with poor airflow."
        ],
    },
    "common rust": {
        "summary": "Common rust produces reddish pustules and becomes more severe in mild, humid weather.",
        "immediate_actions": [
            "Inspect whether lesions are limited or widespread.",
            "Reduce crop stress with timely irrigation and nutrition.",
            "Seek local fungicide advice if infection reaches upper leaves."
        ],
        "prevention_tips": [
            "Grow resistant hybrids.",
            "Scout fields early after weather changes.",
            "Avoid continuous maize in the same field."
        ],
    },
    "early blight": {
        "summary": "Early blight causes concentric brown spots and often worsens in stressed tomato or potato plants.",
        "immediate_actions": [
            "Remove lower infected leaves first.",
            "Keep foliage dry by watering at the base.",
            "Use a recommended protectant fungicide if spread is active."
        ],
        "prevention_tips": [
            "Rotate crops for at least one season.",
            "Mulch soil to reduce splash infection.",
            "Maintain balanced potassium and avoid plant stress."
        ],
    },
    "late blight": {
        "summary": "Late blight is aggressive in cool, wet weather and can damage the crop very quickly.",
        "immediate_actions": [
            "Isolate and remove heavily infected plants immediately.",
            "Avoid moving tools from infected rows to healthy rows without cleaning.",
            "Use urgent local fungicide guidance because timing matters."
        ],
        "prevention_tips": [
            "Monitor weather-driven blight risk.",
            "Avoid prolonged leaf wetness.",
            "Use clean planting material and resistant varieties when available."
        ],
    },
    "powdery mildew": {
        "summary": "Powdery mildew forms white powdery growth and reduces leaf efficiency if ignored.",
        "immediate_actions": [
            "Remove the most infected leaves where feasible.",
            "Open up dense canopy growth for airflow.",
            "Use sulfur or other approved control only if locally suitable."
        ],
        "prevention_tips": [
            "Keep spacing adequate for ventilation.",
            "Avoid excessive nitrogen push in dense crops.",
            "Scout shaded and humid patches first."
        ],
    },
    "septoria leaf spot": {
        "summary": "Septoria leaf spot starts on lower tomato leaves and climbs upward in wet conditions.",
        "immediate_actions": [
            "Prune the lowest infected leaves.",
            "Mulch soil to reduce splash spread.",
            "Apply recommended fungicide if repeated wet weather continues."
        ],
        "prevention_tips": [
            "Rotate crops away from tomato.",
            "Avoid overhead irrigation.",
            "Sanitize crop residue after harvest."
        ],
    },
    "mosaic virus": {
        "summary": "Mosaic virus distorts leaf color and growth, and infected plants usually do not recover fully.",
        "immediate_actions": [
            "Remove severely infected plants to reduce spread.",
            "Disinfect hands and tools after handling infected plants.",
            "Control insect vectors where relevant."
        ],
        "prevention_tips": [
            "Use virus-free seed or seedlings.",
            "Manage weeds that host vectors.",
            "Avoid tobacco handling before touching tomato plants."
        ],
    },
    "yellow leaf curl virus": {
        "summary": "Yellow leaf curl virus leads to curling, yellowing, and stunted tomato growth.",
        "immediate_actions": [
            "Remove badly affected plants early.",
            "Control whitefly pressure around the crop.",
            "Use reflective mulch or traps where practical."
        ],
        "prevention_tips": [
            "Use tolerant hybrids when available.",
            "Raise healthy seedlings in protected conditions.",
            "Keep weeds and vector hosts under control."
        ],
    },
    "leaf mold": {
        "summary": "Leaf mold thrives in humid tomato canopies and usually starts on older leaves.",
        "immediate_actions": [
            "Increase airflow by pruning and spacing.",
            "Water the root zone instead of wetting foliage.",
            "Remove heavily infected leaves to slow spread."
        ],
        "prevention_tips": [
            "Keep greenhouse or dense canopy humidity lower.",
            "Scout lower leaves regularly.",
            "Avoid excess shade and poor ventilation."
        ],
    },
    "two spotted spider mites": {
        "summary": "Spider mite damage causes speckling and bronzing, especially in hot and dry conditions.",
        "immediate_actions": [
            "Check the underside of leaves for mites and webbing.",
            "Wash localized infestations with water where practical.",
            "Use a recommended miticide only after confirming the pest."
        ],
        "prevention_tips": [
            "Reduce dusty field conditions.",
            "Avoid unnecessary broad-spectrum sprays that kill beneficial insects.",
            "Monitor hot and dry corners of the field."
        ],
    },
    "black rot": {
        "summary": "Black rot in grape can affect leaves and fruit clusters if disease pressure remains high.",
        "immediate_actions": [
            "Remove infected leaves and mummified fruit if present.",
            "Keep the canopy open and dry after irrigation or rain.",
            "Follow a locally recommended fungicide schedule for vines."
        ],
        "prevention_tips": [
            "Sanitize infected debris after harvest.",
            "Prune for airflow and sunlight.",
            "Monitor the vineyard closely during humid periods."
        ],
    },
    "healthy leaf": {
        "summary": "The leaf looks healthy in this prediction, with no strong disease signal detected.",
        "immediate_actions": [
            "Continue normal irrigation and nutrient management.",
            "Keep scouting the crop weekly for new symptoms.",
            "Use clean tools and avoid avoidable plant stress."
        ],
        "prevention_tips": [
            "Maintain good field hygiene.",
            "Use balanced fertilizer and timely irrigation.",
            "Inspect leaves after major weather changes."
        ],
    },
}


def get_label_details(label: str) -> dict:
    details = LABEL_DETAILS.get(label, {"crop": "Unknown", "disease": label, "healthy": False})
    disease_key = details["disease"].strip().lower()
    guidance = DISEASE_GUIDANCE.get(disease_key, DISEASE_GUIDANCE["healthy leaf"])
    return {
        **details,
        "summary": guidance["summary"],
        "immediate_actions": guidance["immediate_actions"],
        "prevention_tips": guidance["prevention_tips"],
    }
