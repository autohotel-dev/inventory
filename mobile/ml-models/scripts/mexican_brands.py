"""
mexican_brands.py
Mexican market vehicle brands configuration.
Includes Japanese, American, European, Korean, and Chinese brands popular in Mexico.
"""

# Mexican market brands organized by origin
MEXICAN_MARKET_BRANDS = {
    # Japanese (most popular in Mexico)
    "japanese": {
        "Nissan": ["Versa", "Sentra", "March", "V-Drive", "Kicks", "X-Trail", "Frontier", "NP300", "Altima", "Maxima"],
        "Toyota": ["Corolla", "Camry", "RAV4", "Hilux", "Yaris", "Prius", "Tacoma", "Fortuner", "Avanza"],
        "Honda": ["Civic", "Accord", "CR-V", "HR-V", "City", "Fit", "Pilot", "BR-V"],
        "Mazda": ["Mazda3", "Mazda6", "CX-5", "CX-30", "CX-50", "MX-5"],
        "Suzuki": ["Swift", "Vitara", "S-Cross", "Jimny", "Baleno", "Ignis"],
        "Subaru": ["Impreza", "Forester", "Outback", "XV", "WRX"],
        "Mitsubishi": ["Lancer", "Outlander", "ASX", "L200", "Montero", "Mirage"],
        "Infiniti": ["Q50", "Q60", "QX50", "QX55", "QX60"],
        "Lexus": ["IS", "ES", "RX", "NX", "UX", "GX"],
        "Acura": ["ILX", "TLX", "RDX", "MDX"],
    },
    
    # American
    "american": {
        "Ford": ["F-150", "Ranger", "Explorer", "Escape", "Bronco", "Edge", "Mustang", "Transit"],
        "Chevrolet": ["Aveo", "Onix", "Malibu", "Cavalier", "Captiva", "Traverse", "Silverado", "Tahoe", "Suburban", "Camaro"],
        "Dodge": ["Attitude", "Journey", "Durango", "Charger", "Challenger", "Ram"],
        "Jeep": ["Wrangler", "Cherokee", "Grand Cherokee", "Compass", "Renegade", "Gladiator"],
        "GMC": ["Sierra", "Terrain", "Acadia", "Yukon"],
        "Lincoln": ["Navigator", "Aviator", "Corsair"],
        "Tesla": ["Model 3", "Model Y", "Model S", "Model X"],
    },
    
    # Korean
    "korean": {
        "Hyundai": ["Accent", "Elantra", "Sonata", "Tucson", "Santa Fe", "Creta", "Venue", "Kona", "Palisade"],
        "Kia": ["Rio", "Cerato", "Forte", "Sportage", "Seltos", "Sorento", "Carnival", "Stonic", "Soul"],
        "Genesis": ["G70", "G80", "G90", "GV70", "GV80"],
    },
    
    # European
    "european": {
        "Volkswagen": ["Jetta", "Vento", "Polo", "Golf", "Tiguan", "Taos", "Teramont", "T-Cross", "Saveiro"],
        "SEAT": ["Ibiza", "León", "Arona", "Ateca", "Tarraco"],
        "Renault": ["Duster", "Kwid", "Sandero", "Logan", "Koleos", "Oroch"],
        "Peugeot": ["208", "308", "Partner", "2008", "3008", "5008"],
        "BMW": ["Serie 3", "Serie 5", "X1", "X3", "X5", "X7"],
        "Mercedes-Benz": ["Clase A", "Clase C", "Clase E", "GLA", "GLC", "GLE"],
        "Audi": ["A3", "A4", "A6", "Q3", "Q5", "Q7"],
        "Fiat": ["500", "Mobi", "Pulse", "Fastback", "Strada"],
        "Mini": ["Cooper", "Countryman", "Clubman"],
        "Volvo": ["S60", "XC40", "XC60", "XC90"],
        "Land Rover": ["Defender", "Discovery", "Range Rover", "Evoque"],
        "Citroën": ["C3", "C4", "C5 Aircross", "Berlingo"],
    },
    
    # Chinese (growing rapidly in Mexico)
    "chinese": {
        "BYD": ["Seagull", "Dolphin", "Han", "Tang", "Song Plus", "Yuan Plus", "Fang Cheng Bao"],
        "MG": ["MG3", "MG5", "MG ZS", "MG HS", "MG4", "Marvel R"],
        "Chery": ["Tiggo 2", "Tiggo 4", "Tiggo 7", "Tiggo 8", "Arrizo 5", "Arrizo 6"],
        "Changan": ["CS15", "CS35", "CS55", "CS75", "Alsvin", "UNI-T", "UNI-K"],
        "JAC": ["JS1", "JS2", "JS3", "JS4", "Sei 2", "Sei 3", "Sei 4"],
        "Geely": ["Coolray", "Azkarra", "Emgrand", "Geometry C"],
        "GAC": ["GS3", "GS4", "GS5", "GN8"],
        "BAIC": ["X3", "X5", "X7", "BJ40"],
        "Jetour": ["X70", "X90", "Dashing"],
        "GWM": ["Haval Jolion", "Haval H6", "Tank 300", "Poer"],
        "Omoda": ["C5", "E5"],
        "Jaecoo": ["J7"],
        "DFSK": ["Glory 330", "Glory 500", "Glory 580"],
        "Foton": ["Tunland", "View"],
        "JMC": ["Vigus", "Boardling"],
    },
}

# Get flat list of all brands
def get_all_brands():
    """Get all brand names as a flat list."""
    brands = []
    for origin, brand_dict in MEXICAN_MARKET_BRANDS.items():
        brands.extend(brand_dict.keys())
    return sorted(brands)

# Get all models for a brand
def get_models_for_brand(brand_name):
    """Get all models for a given brand."""
    for origin, brand_dict in MEXICAN_MARKET_BRANDS.items():
        if brand_name in brand_dict:
            return brand_dict[brand_name]
    return []

# Get brand origin
def get_brand_origin(brand_name):
    """Get the origin country/region for a brand."""
    for origin, brand_dict in MEXICAN_MARKET_BRANDS.items():
        if brand_name in brand_dict:
            return origin
    return "unknown"

# Brand to index mapping
def create_brand_mapping():
    """Create brand to index mapping for training."""
    brands = get_all_brands()
    brand_to_idx = {brand: idx for idx, brand in enumerate(brands)}
    idx_to_brand = {idx: brand for brand, idx in brand_to_idx.items()}
    return brand_to_idx, idx_to_brand

# Color mapping (Mexican Spanish)
COLOR_MAP = {
    "blanco": "Blanco",
    "negro": "Negro",
    "plata": "Plata",
    "gris": "Gris",
    "rojo": "Rojo",
    "azul": "Azul",
    "verde": "Verde",
    "amarillo": "Amarillo",
    "naranja": "Naranja",
    "cafe": "Café",
    "beige": "Beige",
    "morado": "Morado",
    "rosa": "Rosa",
    "dorado": "Dorado",
    "vino": "Vino",
}

# Statistics
def print_stats():
    """Print brand statistics."""
    total_brands = 0
    total_models = 0
    
    print("Mexican Market Vehicle Brands:")
    print("=" * 50)
    
    for origin, brands in MEXICAN_MARKET_BRANDS.items():
        brand_count = len(brands)
        model_count = sum(len(models) for models in brands.values())
        total_brands += brand_count
        total_models += model_count
        
        print(f"\n{origin.upper()} ({brand_count} brands, {model_count} models):")
        for brand, models in brands.items():
            print(f"  {brand}: {len(models)} models")
    
    print(f"\n{'=' * 50}")
    print(f"TOTAL: {total_brands} brands, {total_models} models")

if __name__ == "__main__":
    print_stats()
