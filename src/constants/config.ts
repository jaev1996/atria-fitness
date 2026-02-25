export const DISCIPLINES = [
    "Telas",
    "Lira",
    "Glúteos",
    "Pilates",
    "Kangoo",
    "Heels",
    "Flexibilidad",
    "Yoga",
    "Pole"
] as const;

export type Discipline = typeof DISCIPLINES[number];

export interface Tier {
    min: number;
    max: number | null;
    price: number;
}

export const ROOMS = [
    {
        id: "salon-alma",
        name: "Salón Alma",
        disciplines: ["Telas", "Lira", "Glúteos", "Pilates", "Kangoo", "Heels", "Flexibilidad"],
    },
    {
        id: "salon-armonia",
        name: "Salón Armonía",
        disciplines: ["Flexibilidad", "Pilates", "Glúteos", "Yoga"],
    },
    {
        id: "salon-sinergia",
        name: "Salón Sinergia",
        disciplines: ["Pole", "Flexibilidad", "Pilates"],
    }
] as const;

export type RoomId = typeof ROOMS[number]['id'];
