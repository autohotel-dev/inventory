/**
 * Catálogo de marcas y modelos de vehículos
 * Marcas populares en México
 */

export interface VehicleBrand {
    value: string;
    label: string;
    models: string[];
}

export const VEHICLE_BRANDS: VehicleBrand[] = [
    {
        value: "nissan",
        label: "Nissan",
        models: [
            "Versa",
            "Sentra",
            "Altima",
            "Kicks",
            "X-Trail",
            "Pathfinder",
            "March",
            "Note",
            "Frontier",
            "NP300",
            "370Z",
            "GT-R",
            "Tsuru",
            "Platina",
            "Tiida",
            "Aprio",
            "Urvan",
            "Maxima",
            "240SX",
            "300ZX",
            "Rogue",
            "Murano",
            "Armada",
            "Leaf",
            "Ariya",
            "V-Drive",
            "Juke",
            "Quest",
            "Pickup (720)",
            "D21",
            "Xterra"
        ]
    },
    {
        value: "toyota",
        label: "Toyota",
        models: [
            "Corolla",
            "Corolla Cross",
            "Camry",
            "Yaris",
            "Hilux",
            "Tacoma",
            "RAV4",
            "4Runner",
            "Prius",
            "Avanza",
            "Sienna",
            "Tercel",
            "Starlet",
            "Celica",
            "Supra",
            "Tundra",
            "Previa",
            "Highlander",
            "Land Cruiser",
            "C-HR",
            "GR86",
            "Sequoia",
            "FJ Cruiser",
            "Matrix",
            "Echo",
            "Paseo",
            "MR2",
            "Fortuner",
            "bZ4X"
        ]
    },
    {
        value: "chevrolet",
        label: "Chevrolet",
        models: [
            "Aveo",
            "Beat",
            "Onix",
            "Cavalier",
            "Malibu",
            "Cruze",
            "Trax",
            "Equinox",
            "Tahoe",
            "Suburban",
            "Silverado",
            "Cheyenne",
            "Camaro",
            "Corvette",
            "Chevy",
            "Pop",
            "Monza",
            "Astra",
            "Corsa",
            "Meriva",
            "Optra",
            "Spark",
            "Blazer (Clásica)",
            "Blazer",
            "Astro",
            "S-10",
            "Captiva",
            "Tracker",
            "Colorado",
            "Traverse",
            "Groove",
            "Tornado",
            "Impala",
            "Monte Carlo",
            "Nova",
            "Celebrity",
            "Lumina",
            "Venture",
            "Express"
        ]
    },
    {
        value: "volkswagen",
        label: "Volkswagen",
        models: [
            "Vento",
            "Bocho",
            "Jetta",
            "Golf",
            "Polo",
            "Beetle",
            "Passat",
            "Tiguan",
            "Touareg",
            "Amarok",
            "Sedán",
            "Derby",
            "Pointer",
            "Gol",
            "Caribe",
            "Combi",
            "Brasilia",
            "Safari",
            "T-Cross",
            "Taos",
            "Virtus",
            "Nivus",
            "ID.4",
            "ID.3",
            "Saveiro",
            "Bora",
            "Lupo",
            "Clásico",
            "CrossFox",
            "Eurovan",
            "Transporter",
            "Crafter"
        ]
    },
    {
        value: "honda",
        label: "Honda",
        models: [
            "Civic",
            "Accord",
            "City",
            "CR-V",
            "HR-V",
            "Pilot",
            "Odyssey",
            "Fit",
            "CRX",
            "Del Sol",
            "Prelude",
            "Integra",
            "Element",
            "S2000",
            "BR-V",
            "ZR-V",
            "Passport",
            "Ridgeline",
            "Insight",
            "CR-Z"
        ]
    },
    {
        value: "mazda",
        label: "Mazda",
        models: [
            "Mazda2",
            "Mazda3",
            "Mazda6",
            "CX-3",
            "CX-5",
            "CX-9",
            "CX-30",
            "CX-50",
            "CX-70",
            "CX-90",
            "MX-5",
            "BT-50",
            "RX-8",
            "Protegé",
            "MPV",
            "Tribute",
            "626",
            "323"
        ]
    },
    {
        value: "kia",
        label: "Kia",
        models: [
            "Rio",
            "Forte",
            "K5",
            "Seltos",
            "Sportage",
            "Sorento",
            "Carnival",
            "Soul",
            "Stinger",
            "Pride",
            "Sephia",
            "Spectra",
            "Optima",
            "Telluride",
            "EV6",
            "EV9",
            "Niro",
            "Picanto",
            "Stonic",
            "Ceed"
        ]
    },
    {
        value: "hyundai",
        label: "Hyundai",
        models: [
            "Accent",
            "Elantra",
            "Sonata",
            "Venue",
            "Creta",
            "Tucson",
            "Santa Fe",
            "Palisade",
            "Veloster",
            "Ioniq",
            "Ioniq 5",
            "Ioniq 6",
            "Kona",
            "Grand i10",
            "i10",
            "i20",
            "i30",
            "HB20",
            "Starex",
            "H-100",
            "Atos",
            "Genesis Coupé",
            "Azera",
            "ix35"
        ]
    },
    {
        value: "ford",
        label: "Ford",
        models: [
            "Figo",
            "Fiesta",
            "Focus",
            "Fusion",
            "Escape",
            "Explorer",
            "Edge",
            "Expedition",
            "F-150",
            "Ranger",
            "Mustang",
            "Bronco",
            "Bronco Sport",
            "Ikon",
            "Escort",
            "Contour",
            "Taurus",
            "Crown Victoria",
            "Windstar",
            "Aerostar",
            "Econoline",
            "F-250",
            "F-350",
            "Ka",
            "Maverick",
            "Territory",
            "Puma",
            "Lobo",
            "EcoSport",
            "Flex",
            "Transit",
            "Courier",
            "Thunderbird",
            "Galaxy",
            "Grand Marquis"
        ]
    },
    {
        value: "seat",
        label: "SEAT",
        models: [
            "Ibiza",
            "León",
            "Toledo",
            "Arona",
            "Ateca",
            "Tarraco",
            "Córdoba",
            "Mii",
            "Alhambra"
        ]
    },
    {
        value: "cupra",
        label: "CUPRA",
        models: [
            "Formentor",
            "Ateca",
            "León",
            "Born",
            "Tavascan"
        ]
    },
    {
        value: "renault",
        label: "Renault",
        models: [
            "Captur",
            "Clio",
            "Logan",
            "Sandero",
            "Stepway",
            "Kwid",
            "Duster",
            "Koleos",
            "Oroch",
            "Arkana",
            "Megane",
            "Kangoo",
            "Fluence",
            "Symbol",
            "Scala",
            "Trafic",
            "Master"
        ]
    },
    {
        value: "suzuki",
        label: "Suzuki",
        models: [
            "Swift",
            "Baleno",
            "Vitara",
            "Grand Vitara",
            "Ignis",
            "Ciaz",
            "S-Cross",
            "Jimny",
            "Ertiga",
            "Alto",
            "Fronx",
            "SX4",
            "Samurai",
            "Sidekick",
            "XL-7"
        ]
    },
    {
        value: "mitsubishi",
        label: "Mitsubishi",
        models: [
            "Mirage",
            "Outlander",
            "Eclipse Cross",
            "L200",
            "Montero",
            "Montero Sport",
            "ASX",
            "Xpander",
            "Lancer",
            "Galant",
            "Endeavor",
            "Eclipse",
            "Pajero",
            "3000GT",
            "Space Star"
        ]
    },
    {
        value: "peugeot",
        label: "Peugeot",
        models: [
            "208",
            "301",
            "308",
            "408",
            "508",
            "2008",
            "3008",
            "5008",
            "Partner",
            "Rifter",
            "Expert",
            "Boxer",
            "206",
            "207",
            "307",
            "405"
        ]
    },
    {
        value: "citroen",
        label: "Citroën",
        models: [
            "C3",
            "C4",
            "C4 Cactus",
            "C5 Aircross",
            "Berlingo",
            "Jumpy",
            "C-Elysée",
            "C1"
        ]
    },
    {
        value: "fiat",
        label: "Fiat",
        models: [
            "Uno",
            "Palio",
            "500",
            "500X",
            "Mobi",
            "Argo",
            "Cronos",
            "Toro",
            "Ducato",
            "Pulse",
            "Fastback",
            "Strada",
            "Fiorino",
            "Doblò",
            "Tipo",
            "Punto",
            "Linea",
            "Siena"
        ]
    },
    {
        value: "dodge",
        label: "Dodge",
        models: [
            "Attitude",
            "Neon",
            "Challenger",
            "Charger",
            "Durango",
            "Atos",
            "Stratus",
            "Intrepid",
            "Dakota",
            "Viper",
            "Caravan",
            "Grand Caravan",
            "Journey",
            "Vision",
            "Avenger",
            "Dart",
            "Nitro",
            "Caliber",
            "Shadow",
            "Spirit",
            "Stealth"
        ]
    },
    {
        value: "ram",
        label: "RAM",
        models: [
            "700",
            "1200",
            "1500",
            "2500",
            "3500",
            "4000",
            "ProMaster",
            "ProMaster City"
        ]
    },
    {
        value: "chrysler",
        label: "Chrysler",
        models: [
            "300",
            "Pacifica",
            "Voyager",
            "Town & Country",
            "PT Cruiser",
            "Sebring",
            "200",
            "Crossfire",
            "Neon",
            "Cirrus",
            "Concorde",
            "New Yorker",
            "LeBaron",
            "Shadow"
        ]
    },
    {
        value: "jeep",
        label: "Jeep",
        models: [
            "Renegade",
            "Compass",
            "Cherokee",
            "Rubicon",
            "Grand Cherokee",
            "Grand Cherokee L",
            "Wrangler",
            "Gladiator",
            "Avenger",
            "Wagoneer",
            "Grand Wagoneer",
            "Liberty",
            "Patriot",
            "Commander"
        ]
    },
    {
        value: "bmw",
        label: "BMW",
        models: [
            "Serie 1",
            "Serie 2",
            "Serie 3",
            "Serie 4",
            "Serie 5",
            "Serie 7",
            "Serie 8",
            "X1",
            "X2",
            "X3",
            "X4",
            "X5",
            "X6",
            "X7",
            "Z4",
            "i4",
            "iX",
            "iX3",
            "M3",
            "M4",
            "M5"
        ]
    },
    {
        value: "mercedes",
        label: "Mercedes-Benz",
        models: [
            "Clase A",
            "Clase C",
            "Clase E",
            "Clase S",
            "CLA",
            "CLS",
            "GLA",
            "GLB",
            "GLC",
            "GLE",
            "GLS",
            "AMG GT",
            "EQA",
            "EQB",
            "EQE",
            "EQS",
            "Sprinter",
            "Vito",
            "Metris",
            "SLK",
            "SL"
        ]
    },
    {
        value: "audi",
        label: "Audi",
        models: [
            "A1",
            "A3",
            "A4",
            "A5",
            "A6",
            "A7",
            "A8",
            "Q2",
            "Q3",
            "Q5",
            "Q7",
            "Q8",
            "TT",
            "R8",
            "e-tron",
            "e-tron GT",
            "Q4 e-tron",
            "RS3",
            "RS5",
            "S3",
            "S4"
        ]
    },
    {
        value: "acura",
        label: "Acura",
        models: [
            "ILX",
            "TLX",
            "RDX",
            "MDX",
            "Integra",
            "NSX",
            "TSX",
            "RSX",
            "TL",
            "RL"
        ]
    },
    {
        value: "infiniti",
        label: "Infiniti",
        models: [
            "Q50",
            "Q60",
            "QX50",
            "QX55",
            "QX60",
            "QX80",
            "G35",
            "G37",
            "FX35",
            "FX45"
        ]
    },
    {
        value: "lexus",
        label: "Lexus",
        models: [
            "IS",
            "ES",
            "GS",
            "LS",
            "NX",
            "RX",
            "UX",
            "GX",
            "LX",
            "LC",
            "RC",
            "CT"
        ]
    },
    {
        value: "lincoln",
        label: "Lincoln",
        models: [
            "Corsair",
            "Nautilus",
            "Aviator",
            "Navigator",
            "MKZ",
            "MKC",
            "MKX",
            "Continental",
            "Town Car"
        ]
    },
    {
        value: "cadillac",
        label: "Cadillac",
        models: [
            "CT4",
            "CT5",
            "XT4",
            "XT5",
            "XT6",
            "Escalade",
            "LYRIQ",
            "ATS",
            "CTS",
            "SRX",
            "XTS",
            "DeVille",
            "Seville"
        ]
    },
    {
        value: "buick",
        label: "Buick",
        models: [
            "Enclave",
            "Encore",
            "Encore GX",
            "Envision",
            "LaCrosse",
            "Regal",
            "Verano",
            "Century",
            "LeSabre",
            "Park Avenue",
            "Rendezvous"
        ]
    },
    {
        value: "gmc",
        label: "GMC",
        models: [
            "Sierra",
            "Canyon",
            "Terrain",
            "Acadia",
            "Yukon",
            "Yukon XL",
            "Savana",
            "Hummer EV"
        ]
    },
    {
        value: "porsche",
        label: "Porsche",
        models: [
            "Cayenne",
            "Macan",
            "911",
            "Panamera",
            "Taycan",
            "Boxster",
            "Cayman",
            "718"
        ]
    },
    {
        value: "land_rover",
        label: "Land Rover",
        models: [
            "Defender",
            "Discovery",
            "Discovery Sport",
            "Range Rover",
            "Range Rover Sport",
            "Range Rover Evoque",
            "Range Rover Velar",
            "Freelander"
        ]
    },
    {
        value: "volvo",
        label: "Volvo",
        models: [
            "S40",
            "S60",
            "S90",
            "V40",
            "V60",
            "XC40",
            "XC60",
            "XC90",
            "C40",
            "C30",
            "V50",
            "850"
        ]
    },
    {
        value: "subaru",
        label: "Subaru",
        models: [
            "Impreza",
            "Crosstrek",
            "Legacy",
            "Outback",
            "Forester",
            "WRX",
            "BRZ",
            "Ascent",
            "XV",
            "Solterra"
        ]
    },
    {
        value: "mini",
        label: "MINI",
        models: [
            "Cooper",
            "Cooper S",
            "Countryman",
            "Clubman",
            "Paceman",
            "Convertible",
            "John Cooper Works"
        ]
    },
    {
        value: "byd",
        label: "BYD",
        models: [
            "Dolphin",
            "Dolphin Mini",
            "Seal",
            "Atto 3",
            "Han",
            "Tang",
            "Song Plus",
            "Yuan Plus",
            "Qin",
            "Shark",
            "King"
        ]
    },
    {
        value: "mg",
        label: "MG",
        models: [
            "MG3",
            "MG4",
            "MG5",
            "MG6",
            "MG ZS",
            "MG ZS EV",
            "MG RX5",
            "MG HS",
            "MG GT",
            "MG ONE",
            "MG VS",
            "MG Marvel R",
            "MG Mulan"
        ]
    },
    {
        value: "geely",
        label: "Geely",
        models: [
            "Coolray",
            "Okavango",
            "Azkarra",
            "Emgrand",
            "GS",
            "Tugella",
            "Monjaro",
            "Preface",
            "Starray"
        ]
    },
    {
        value: "jetour",
        label: "Jetour",
        models: [
            "X70",
            "X70 Plus",
            "X90",
            "X90 Plus",
            "Dashing",
            "T1",
            "T2"
        ]
    },
    {
        value: "chery",
        label: "Chery",
        models: [
            "Tiggo 2",
            "Tiggo 3",
            "Tiggo 4",
            "Tiggo 4 Pro",
            "Tiggo 7",
            "Tiggo 7 Pro",
            "Tiggo 8",
            "Tiggo 8 Pro",
            "Tiggo 8 Pro Max",
            "Arrizo 5",
            "Arrizo 6",
            "Arrizo 6 Pro"
        ]
    },
    {
        value: "omoda",
        label: "Omoda / Jaecoo",
        models: [
            "Omoda 5",
            "Omoda C5",
            "Omoda E5",
            "Jaecoo 7",
            "Jaecoo 8"
        ]
    },
    {
        value: "changan",
        label: "Changan",
        models: [
            "CS15",
            "CS35",
            "CS35 Plus",
            "CS55",
            "CS55 Plus",
            "CS75",
            "CS75 Plus",
            "CS85",
            "CS95",
            "Alsvin",
            "Eado",
            "Hunter",
            "UNI-T",
            "UNI-K",
            "UNI-V"
        ]
    },
    {
        value: "jac",
        label: "JAC",
        models: [
            "S2",
            "S3",
            "S4",
            "S7",
            "T6",
            "T8",
            "E10X",
            "JS4",
            "JS3",
            "JS2",
            "Sei 4",
            "Sei 7",
            "Sunray",
            "Refine",
            "Frison"
        ]
    },
    {
        value: "haval",
        label: "Haval / Great Wall",
        models: [
            "H6",
            "Jolion",
            "Dargo",
            "H2",
            "H5",
            "H9",
            "Poer",
            "Wingle",
            "ORA 03"
        ]
    },
    {
        value: "baic",
        label: "BAIC",
        models: [
            "X35",
            "X55",
            "X65",
            "D20",
            "U5 Plus",
            "Beijing X7",
            "Senova"
        ]
    },
    {
        value: "tesla",
        label: "Tesla",
        models: [
            "Model 3",
            "Model Y",
            "Model S",
            "Model X",
            "Cybertruck"
        ]
    },
    {
        value: "motocicleta",
        label: "Motocicleta",
        models: [
            "Italika",
            "Honda",
            "Yamaha",
            "Suzuki",
            "Kawasaki",
            "BMW",
            "Harley-Davidson",
            "KTM",
            "Ducati",
            "Bajaj",
            "Vento",
            "Benelli",
            "Royal Enfield",
            "CF Moto",
            "Carabela",
            "Kurazai",
            "Dinamo",
            "Otro"
        ]
    }
];

// Opción para autos no listados
export const OTHER_BRAND = {
    value: "other",
    label: "Otra marca",
    models: ["Otro modelo"]
};

/**
 * Obtiene los modelos para una marca específica
 */
export function getModelsForBrand(brandValue: string): string[] {
    if (brandValue === "other") {
        return OTHER_BRAND.models;
    }

    const brand = VEHICLE_BRANDS.find(b => b.value === brandValue);
    return brand?.models || [];
}

/**
 * Opciones para selector de marcas (incluye "Otra")
 */
export function getBrandOptions() {
    return [
        ...VEHICLE_BRANDS.map(b => ({ value: b.value, label: b.label })),
        { value: OTHER_BRAND.value, label: OTHER_BRAND.label }
    ];
}

/**
 * Busca un modelo en todas las marcas y retorna la marca que lo contiene
 * Útil cuando conocen el modelo pero no la marca
 */
export function findBrandByModel(modelName: string): VehicleBrand | null {
    const normalizedSearch = modelName.toLowerCase().trim();

    for (const brand of VEHICLE_BRANDS) {
        const modelFound = brand.models.find(
            model => model.toLowerCase() === normalizedSearch
        );

        if (modelFound) {
            return brand;
        }
    }

    return null;
}

/**
 * Busca marcas y modelos que coincidan con el término de búsqueda
 * Retorna resultados agrupados por marca
 */
export interface VehicleSearchResult {
    brand: VehicleBrand;
    model: string;
    label: string; // Para mostrar: "Toyota Corolla"
}

export function searchVehicles(searchTerm: string): VehicleSearchResult[] {
    if (!searchTerm || searchTerm.trim().length < 2) return [];

    const normalizedSearch = searchTerm.toLowerCase().trim();
    const results: VehicleSearchResult[] = [];

    for (const brand of VEHICLE_BRANDS) {
        // Buscar en modelos
        const matchingModels = brand.models.filter(model =>
            model.toLowerCase().includes(normalizedSearch)
        );

        // Agregar resultados
        matchingModels.forEach(model => {
            results.push({
                brand,
                model,
                label: `${brand.label} ${model}`
            });
        });
    }

    return results.slice(0, 10); // Limitar a 10 resultados
}

/**
 * Obtiene todas las combinaciones de marca-modelo para búsqueda global
 * Formato: [{ value: "toyota-corolla", label: "Toyota Corolla" }]
 */
export function getAllVehicleCombinations() {
    const combinations: { value: string; label: string; brandValue: string; model: string }[] = [];

    VEHICLE_BRANDS.forEach(brand => {
        brand.models.forEach(model => {
            combinations.push({
                value: `${brand.value}-${model.toLowerCase().replace(/\s+/g, '-')}`,
                label: `${brand.label} ${model}`,
                brandValue: brand.value,
                model: model
            });
        });
    });

    return combinations;
}
