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
            "300ZX"
        ]
    },
    {
        value: "toyota",
        label: "Toyota",
        models: [
            "Corolla",
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
            "Previa"
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
            "Astro",
            "S-10"
        ]
    },
    {
        value: "volkswagen",
        label: "Volkswagen",
        models: [
            "Vento",
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
            "Safari"
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
            "S2000"
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
            "MX-5"
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
            "Optima"
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
            "Ioniq"
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
            "Ka"
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
            "Tarraco"
        ]
    },
    {
        value: "renault",
        label: "Renault",
        models: [
            "Logan",
            "Sandero",
            "Stepway",
            "Kwid",
            "Duster",
            "Koleos",
            "Oroch"
        ]
    },
    {
        value: "suzuki",
        label: "Suzuki",
        models: [
            "Swift",
            "Vitara",
            "Ignis",
            "Ciaz",
            "S-Cross",
            "Jimny"
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
            "ASX"
        ]
    },
    {
        value: "peugeot",
        label: "Peugeot",
        models: [
            "208",
            "301",
            "2008",
            "3008",
            "5008",
            "Partner"
        ]
    },
    {
        value: "fiat",
        label: "Fiat",
        models: [
            "Uno",
            "Palio",
            "500",
            "Mobi",
            "Argo",
            "Cronos",
            "Toro",
            "Ducato"
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
            "Ram",
            "Atos",
            "Stratus",
            "Intrepid",
            "Dakota",
            "Viper",
            "Caravan"
        ]
    },
    {
        value: "jeep",
        label: "Jeep",
        models: [
            "Renegade",
            "Compass",
            "Cherokee",
            "Grand Cherokee",
            "Wrangler",
            "Gladiator"
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
            "X1",
            "X3",
            "X5",
            "X6",
            "X7",
            "Z4"
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
            "GLA",
            "GLB",
            "GLC",
            "GLE",
            "GLS"
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
            "R8"
        ]
    },
    {
        value: "byd",
        label: "BYD",
        models: [
            "Dolphin",
            "Seal",
            "Atto 3",
            "Han",
            "Tang",
            "Song Plus",
            "Yuan Plus",
            "Qin"
        ]
    },
    {
        value: "mg",
        label: "MG",
        models: [
            "MG5",
            "MG6",
            "MG ZS",
            "MG RX5",
            "MG HS",
            "MG GT",
            "MG ONE"
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
            "Tugella"
        ]
    },
    {
        value: "jetour",
        label: "Jetour",
        models: [
            "X70",
            "X70 Plus",
            "X90",
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
            "Tiggo 7",
            "Tiggo 8",
            "Tiggo 8 Pro",
            "Arrizo 5",
            "Arrizo 6",
            "Omoda 5"
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
            "CS75",
            "CS85",
            "Alsvin",
            "Eado",
            "Hunter"
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
            "JS4"
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
