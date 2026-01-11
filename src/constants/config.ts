export const DISCIPLINES = ["Pole Dance", "Yoga", "Telas", "Glúteos"] as const;

export type Discipline = typeof DISCIPLINES[number];

export const ROOMS = [
    { id: "sala-pole", name: "Sala Pole", discipline: "Pole Dance" },
    { id: "sala-yoga", name: "Sala Yoga", discipline: "Yoga" },
    { id: "sala-telas", name: "Sala Telas", discipline: "Telas" },
    { id: "sala-gluteos", name: "Sala Glúteos", discipline: "Glúteos" }
] as const;

export type RoomId = typeof ROOMS[number]['id'];
