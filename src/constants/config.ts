export const DISCIPLINES = ["Pole Exotic", "Yoga", "Telas", "Glúteos"] as const;

export type Discipline = typeof DISCIPLINES[number];

export interface Tier {
    min: number;
    max: number | null;
    price: number;
}

export const ROOMS = [
    {
        id: "sala-pole",
        name: "Sala Pole",
        discipline: "Pole Exotic",
        privateRate: 25,
        rates: [
            { min: 1, max: 2, price: 10 },
            { min: 3, max: 4, price: 15 },
            { min: 5, max: null, price: 20 }
        ]
    },
    {
        id: "sala-yoga",
        name: "Sala Yoga",
        discipline: "Yoga",
        privateRate: 25,
        rates: [
            { min: 1, max: 2, price: 10 },
            { min: 3, max: 4, price: 15 },
            { min: 5, max: null, price: 20 }
        ]
    },
    {
        id: "sala-telas",
        name: "Sala Telas",
        discipline: "Telas",
        privateRate: 25,
        rates: [
            { min: 1, max: 2, price: 10 },
            { min: 3, max: 4, price: 15 },
            { min: 5, max: null, price: 20 }
        ]
    },
    {
        id: "sala-gluteos",
        name: "Sala Glúteos",
        discipline: "Glúteos",
        privateRate: 25,
        rates: [
            { min: 1, max: 2, price: 10 },
            { min: 3, max: 4, price: 15 },
            { min: 5, max: null, price: 20 }
        ]
    }
] as const;

export type RoomId = typeof ROOMS[number]['id'];
