import { RoomId } from "@/constants/config";

// Tipos básicos
export type HistoryEntry = {
    id: string;
    date: string;
    activity: string;
    notes: string;
    cost: number; // Can be 0 for automated deductions related to credits
};

// Pagos
export type PaymentMethod = 'Efectivo' | 'Transferencia' | 'Tarjeta' | 'Otro';

export type Payment = {
    id: string;
    date: string;
    amount: number;
    method: PaymentMethod;
    concept: string; // e.g. "Pack 8 Clases"
};

// Plan de la alumna
export type StudentPlan = {
    id: string;
    disciplina: string; // e.g. "Pole Exotic", "Yoga", "General"
    creditos: number; // Remaining credits
    activo: boolean;
    nombreOriginal: string; // "Pack 8 Clases"
    expiryDate?: string;
};

export type StudentStatus = 'active' | 'inactive' | 'guest';

export type Student = {
    id: string;
    name: string;
    email: string;
    phone: string;

    // Medical & Info
    medicalInfo: string;
    allergies: string;
    injuries: string;
    conditions: string;
    emergencyContact: string;

    sportsInfo: string;
    status: StudentStatus;

    // Plans (Multi-discipline)
    plans: StudentPlan[];
    payments: Payment[];

    history: HistoryEntry[];
};

export type Instructor = {
    id: string;
    name: string;
    specialties: string[];
    email?: string;
    phone?: string;
    bio?: string;
};

export type InstructorPayment = {
    id: string;
    instructorId: string;
    instructorName: string;
    date: string; // Fecha en que se registra el pago
    amount: number;
    startDate: string; // Inicio del rango pagado
    endDate: string; // Fin del rango pagado
    classIds: string[]; // IDs de las clases incluidas en este pago
    notes?: string;
};

export type ClassStatus = 'scheduled' | 'confirmed' | 'rescheduled' | 'cancelled' | 'completed';

export type Attendee = {
    studentId: string;
    studentName: string;
    status: 'booked' | 'cancelled';
    attendanceType: 'standard' | 'courtesy';
    creditDeducted: boolean;
};

export type ClassSession = {
    id: string;
    instructorId: string;
    instructorName: string;
    date: string;
    startTime: string;
    endTime: string;

    status: ClassStatus;
    type: string;
    room: RoomId; // Updated to strict RoomId
    maxCapacity: number;
    attendees: Attendee[];

    notes?: string;
    isPrivate?: boolean;
    paymentId?: string; // ID del pago al instructor al que pertenece esta clase
};

export const calculateClassPayment = (classSession: ClassSession): number => {
    const state = db.getAll();
    const disciplineSettings = state.settings?.disciplineRates?.[classSession.type];

    const privateRate = disciplineSettings?.privateRate ?? 25;
    const rates = disciplineSettings?.rates ?? [
        { min: 1, max: 2, price: 10 },
        { min: 3, max: 4, price: 15 },
        { min: 5, max: null, price: 20 }
    ];

    // Si es clase privada, el precio es fijo
    if (classSession.isPrivate) return privateRate;

    // Solo se cuentan alumnos con estado 'booked' (asistentes)
    const assistants = classSession.attendees.filter(a => a.status === 'booked').length;

    // Buscar el tier correspondiente
    const tier = rates.find(t =>
        assistants >= t.min && (t.max === null || assistants <= t.max)
    );

    return tier ? tier.price : 0;
};

export type StorageData = {
    students: Student[];
    instructors: Instructor[];
    classes: ClassSession[];
    instructorPayments: InstructorPayment[];
    settings?: {
        disciplines?: string[]; // Deprecated, kept for compatibility if any
        disciplineRates: Record<string, {
            privateRate: number;
            rates: { min: number, max: number | null, price: number }[];
        }>;
        roomDisciplines?: Record<string, string[]>;
    };
};

const STORAGE_KEY = 'atria_fitness_data_v3';

const DEFAULT_DATA: StorageData = {
    students: [],
    instructors: [],
    classes: [],
    instructorPayments: []
};

export const db = {
    // Obtener todo el estado
    getAll: (): StorageData => {
        if (typeof window === 'undefined') return DEFAULT_DATA;
        const data = localStorage.getItem(STORAGE_KEY);
        if (!data) {
            return db.seed();
        }
        try {
            const parsed = JSON.parse(data);
            return {
                students: parsed.students || [],
                instructors: parsed.instructors || [],
                classes: parsed.classes || [],
                instructorPayments: parsed.instructorPayments || [],
                settings: parsed.settings
            };
        } catch (e) {
            console.error("Error parsing storage data", e);
            return DEFAULT_DATA;
        }
    },

    // Guardar estado
    save: (data: StorageData) => {
        if (typeof window === 'undefined') return;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        window.dispatchEvent(new Event("storage-update"));
    },

    seed: (): StorageData => {
        const initialData: StorageData = {
            students: [
                { id: "s1", name: "Ana Martínez", email: "ana@example.com", phone: "555-0001", medicalInfo: "", allergies: "", injuries: "", conditions: "", emergencyContact: "", sportsInfo: "", status: "active", plans: [{ id: "p1", disciplina: "General", creditos: 8, activo: true, nombreOriginal: "Pack 8 Clases" }], payments: [], history: [] },
                { id: "s2", name: "Beatriz López", email: "beatriz@example.com", phone: "555-0002", medicalInfo: "", allergies: "", injuries: "", conditions: "", emergencyContact: "", sportsInfo: "", status: "active", plans: [{ id: "p2", disciplina: "General", creditos: 12, activo: true, nombreOriginal: "Pack 12 Clases" }], payments: [], history: [] },
                { id: "s3", name: "Carla García", email: "carla@example.com", phone: "555-0003", medicalInfo: "", allergies: "", injuries: "", conditions: "", emergencyContact: "", sportsInfo: "", status: "active", plans: [{ id: "p3", disciplina: "General", creditos: 4, activo: true, nombreOriginal: "Pack 4 Clases" }], payments: [], history: [] },
                { id: "s4", name: "Daniela Rivas", email: "daniela@example.com", phone: "555-0004", medicalInfo: "", allergies: "", injuries: "", conditions: "", emergencyContact: "", sportsInfo: "", status: "active", plans: [{ id: "p4", disciplina: "General", creditos: 8, activo: true, nombreOriginal: "Pack 8 Clases" }], payments: [], history: [] },
                { id: "s5", name: "Elena Torres", email: "elena@example.com", phone: "555-0005", medicalInfo: "", allergies: "", injuries: "", conditions: "", emergencyContact: "", sportsInfo: "", status: "active", plans: [{ id: "p5", disciplina: "General", creditos: 20, activo: true, nombreOriginal: "Plan Ilimitado" }], payments: [], history: [] },
                { id: "s6", name: "Fernanda Luna", email: "fernanda@example.com", phone: "555-0006", medicalInfo: "", allergies: "", injuries: "", conditions: "", emergencyContact: "", sportsInfo: "", status: "active", plans: [{ id: "p6", disciplina: "General", creditos: 8, activo: true, nombreOriginal: "Pack 8 Clases" }], payments: [], history: [] },
                { id: "s7", name: "Gabriela Sol", email: "gabriela@example.com", phone: "555-0007", medicalInfo: "", allergies: "", injuries: "", conditions: "", emergencyContact: "", sportsInfo: "", status: "active", plans: [{ id: "p7", disciplina: "General", creditos: 8, activo: true, nombreOriginal: "Pack 8 Clases" }], payments: [], history: [] },
                { id: "s8", name: "Hilda Paz", email: "hilda@example.com", phone: "555-0008", medicalInfo: "", allergies: "", injuries: "", conditions: "", emergencyContact: "", sportsInfo: "", status: "active", plans: [{ id: "p8", disciplina: "General", creditos: 8, activo: true, nombreOriginal: "Pack 8 Clases" }], payments: [], history: [] },
                { id: "s9", name: "Isabel Rio", email: "isabel@example.com", phone: "555-0009", medicalInfo: "", allergies: "", injuries: "", conditions: "", emergencyContact: "", sportsInfo: "", status: "active", plans: [{ id: "p9", disciplina: "General", creditos: 8, activo: true, nombreOriginal: "Pack 8 Clases" }], payments: [], history: [] },
                { id: "s10", name: "Juana Mar", email: "juana@example.com", phone: "555-0010", medicalInfo: "", allergies: "", injuries: "", conditions: "", emergencyContact: "", sportsInfo: "", status: "active", plans: [{ id: "p10", disciplina: "General", creditos: 8, activo: true, nombreOriginal: "Pack 8 Clases" }], payments: [], history: [] },
            ],
            instructors: [
                { id: "i1", name: "Maria", specialties: ["Flexibilidad", "Yoga"], email: "maria@atria.com", phone: "555-1001" },
                { id: "i2", name: "Lucia", specialties: ["Telas", "Lira"], email: "lucia@atria.com", phone: "555-1002" },
                { id: "i3", name: "Paula", specialties: ["Pole", "Heels"], email: "paula@atria.com", phone: "555-1003" },
                { id: "i4", name: "Elena", specialties: ["Pilates", "Glúteos"], email: "elena@atria.com", phone: "555-1004" },
                { id: "i5", name: "Sofia", specialties: ["Kangoo"], email: "sofia@atria.com", phone: "555-1005" }
            ],
            classes: [],
            instructorPayments: []
        };
        db.save(initialData);
        return initialData;
    },

    // CRUD Alumnas
    getStudents: () => db.getAll().students,

    getStudent: (id: string) => {
        const students = db.getStudents();
        return students.find(s => s.id === id);
    },

    addStudent: (data: Omit<Student, 'id' | 'history' | 'payments' | 'plans' | 'status'> & { planType: string, discipline?: string, status?: StudentStatus }) => {
        const state = db.getAll();
        const { planType, discipline, ...studentInfo } = data;

        const initialPlans: StudentPlan[] = [];
        if (planType && planType !== 'Sin Plan') {
            let credits = 8;
            if (planType === 'Ilimitado') credits = 999;
            if (planType === 'Clase Suelta') credits = 1;
            if (planType === 'Pack 12 Clases') credits = 12;
            if (planType === 'Pack 4 Clases') credits = 4;
            if (planType === 'Pack 24 Clases') credits = 24;

            initialPlans.push({
                id: Date.now().toString(),
                disciplina: discipline || "General",
                creditos: credits,
                activo: true,
                nombreOriginal: planType
            });
        }

        const newStudent: Student = {
            ...studentInfo,
            id: Date.now().toString(),
            history: [],
            payments: [],
            plans: initialPlans,
            status: data.status || 'active'
        };

        state.students.push(newStudent);
        db.save(state);
        return newStudent;
    },

    deleteStudentPlan: (studentId: string, planId: string) => {
        const state = db.getAll();
        const student = state.students?.find((s: Student) => s.id === studentId);
        if (student && student.plans) {
            student.plans = student.plans.filter((p: StudentPlan) => p.id !== planId);
            db.save(state);
        }
    },



    updateStudent: (id: string, updates: Partial<Student>) => {
        const state = db.getAll();
        const index = state.students.findIndex((s) => s.id === id);
        if (index !== -1) {
            state.students[index] = { ...state.students[index], ...updates };
            db.save(state);
        }
    },

    deleteStudent: (id: string) => {
        const state = db.getAll();
        if (state.students) {
            state.students = state.students.filter((s: Student) => s.id !== id);
            db.save(state);
        }
    },

    // Payments & Plans Logic
    processPayment: (studentId: string, amount: number, method: PaymentMethod, planName: string, credits: number, discipline: string = "General") => {
        const state = db.getAll();
        const student = state.students?.find((s: Student) => s.id === studentId);

        if (student) {
            const payment: Payment = {
                id: Date.now().toString(),
                date: new Date().toISOString().split('T')[0],
                amount,
                method,
                concept: planName
            };
            if (!student.payments) student.payments = [];

            const newPlan: StudentPlan = {
                id: `p-${Date.now()}`,
                disciplina: discipline,
                creditos: credits,
                activo: true,
                nombreOriginal: planName
            };

            if (!student.plans) student.plans = [];
            student.plans.push(newPlan);
            student.payments.push(payment);

            db.save(state);
        }
    },

    addHistoryEntry: (studentId: string, entry: Omit<HistoryEntry, 'id'>) => {
        const state = db.getAll();
        const student = state.students?.find((s: Student) => s.id === studentId);
        if (student) {
            student.history.push({ ...entry, id: Date.now().toString() });
            db.save(state);
        }
    },

    deleteHistoryEntry: (studentId: string, entryId: string) => {
        const state = db.getAll();
        const student = state.students?.find((s: Student) => s.id === studentId);
        if (student) {
            student.history = student.history.filter((e: HistoryEntry) => e.id !== entryId);
            db.save(state);
        }
    },

    // CRUD Instructores
    getInstructors: () => db.getAll().instructors,

    addInstructor: (data: Omit<Instructor, 'id'>) => {
        const state = db.getAll();
        if (!state.instructors) state.instructors = [];
        const newInstructor = { ...data, id: Date.now().toString() };
        state.instructors.push(newInstructor);
        db.save(state);
        return newInstructor;
    },

    updateInstructor: (id: string, updates: Partial<Instructor>) => {
        const state = db.getAll();
        if (state.instructors) {
            const idx = state.instructors.findIndex((i: Instructor) => i.id === id);
            if (idx !== -1) {
                state.instructors[idx] = { ...state.instructors[idx], ...updates };
                db.save(state);
            }
        }
    },

    deleteInstructor: (id: string) => {
        const state = db.getAll();
        if (state.instructors) {
            state.instructors = state.instructors.filter((i: Instructor) => i.id !== id);
            db.save(state);
        }
    },

    // CRUD Clases
    getClasses: () => db.getAll().classes,

    addClass: (classSession: Omit<ClassSession, 'id' | 'attendees' | 'endTime'>) => {
        const state = db.getAll();

        const [h, m] = classSession.startTime.split(':').map(Number);
        const endH = h + 1;
        const endTime = `${endH.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;

        const newClass: ClassSession = {
            ...classSession,
            id: Date.now().toString(),
            endTime,
            attendees: [],
            isPrivate: classSession.isPrivate ?? false
        };
        state.classes.push(newClass);
        db.save(state);
        return newClass;
    },

    updateClass: (classData: ClassSession) => {
        const state = db.getAll();
        const index = state.classes.findIndex((c) => c.id === classData.id);
        if (index !== -1) {
            const oldClass = state.classes[index];
            state.classes[index] = classData;

            // CHECK FOR COMPLETION LOGIC
            if (classData.status === 'completed' && oldClass.status !== 'completed') {
                classData.attendees.forEach(attendee => {
                    if (attendee.status === 'booked' && !attendee.creditDeducted && attendee.attendanceType === 'standard') {
                        const studentIndex = state.students.findIndex((s) => s.id === attendee.studentId);
                        if (studentIndex !== -1) {
                            const student = state.students[studentIndex];
                            const plan = student.plans?.find((p) =>
                                p.activo && (p.disciplina === classData.type || classData.type.includes(p.disciplina) || p.disciplina === 'General')
                            );

                            if (plan && plan.creditos > 0) {
                                plan.creditos -= 1;
                                attendee.creditDeducted = true;

                                // Add to History automatically
                                student.history.push({
                                    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                                    date: new Date().toISOString().split('T')[0],
                                    activity: `Clase Completada: ${classData.type}`,
                                    notes: `Instructor: ${classData.instructorName}`,
                                    cost: 0
                                });

                                // Autodelete plan if credits reach 0
                                if (plan.creditos <= 0 && plan.nombreOriginal !== 'Ilimitado') {
                                    student.plans = student.plans.filter(p => p.id !== plan.id);
                                }
                            }
                        }
                    }
                });
            }
            db.save(state);
        }
    },

    deleteClass: (id: string) => {
        const state = db.getAll();
        if (state.classes) {
            state.classes = state.classes.filter((c: ClassSession) => c.id !== id);
            db.save(state);
        }
    },

    // Enrollment Logic
    enrollStudent: (classId: string, studentId: string, studentName: string, type: 'standard' | 'courtesy' = 'standard') => {
        const state = db.getAll();
        const classSession = state.classes?.find((c: ClassSession) => c.id === classId);
        const student = state.students?.find((s: Student) => s.id === studentId);

        if (!classSession) throw new Error("Clase no encontrada");
        if (!student) throw new Error("Alumna no encontrada");

        if (classSession.attendees.length >= classSession.maxCapacity) {
            throw new Error("Clase llena (Cupos agotados)");
        }
        if (classSession.attendees.find((a: Attendee) => a.studentId === studentId && a.status === 'booked')) {
            throw new Error("Alumna ya inscrita");
        }

        // Check for Collision: Student cannot be in two classes at same time
        const hasCollision = state.classes.some((c: ClassSession) =>
            c.id !== classId &&
            c.date === classSession.date &&
            c.startTime === classSession.startTime &&
            c.status !== 'cancelled' &&
            c.attendees.some((a: Attendee) => a.studentId === studentId && a.status === 'booked')
        );
        if (hasCollision) {
            throw new Error("Colisión: La alumna ya tiene una clase a esta hora.");
        }

        if (type === 'standard' && student.status !== 'guest') {
            const hasValidPlan = student.plans?.some((p: StudentPlan) =>
                p.activo &&
                p.creditos > 0 &&
                (
                    p.disciplina === classSession.type ||
                    classSession.type.includes(p.disciplina) ||
                    p.disciplina.includes(classSession.type) ||
                    (p.disciplina === 'Pole Exotic' && classSession.type === 'Pole Sport') || // Compatibility
                    (p.disciplina === 'Pole Sport' && classSession.type === 'Pole Exotic') || // Compatibility
                    p.disciplina === 'General'
                )
            );

            if (!hasValidPlan) {
                throw new Error(`No tiene un plan activo/créditos para ${classSession.type}`);
            }
        }

        classSession.attendees.push({
            studentId,
            studentName,
            status: 'booked',
            attendanceType: type,
            creditDeducted: false
        });

        db.save(state);
    },

    removeAttendee: (classId: string, studentId: string) => {
        const state = db.getAll();
        const classSession = state.classes?.find((c: ClassSession) => c.id === classId);
        if (classSession) {
            const attendee = classSession.attendees.find((a: Attendee) => a.studentId === studentId);
            if (attendee && attendee.creditDeducted) {
                const student = state.students.find((s: Student) => s.id === studentId);
                if (student) {
                    const plan = student.plans?.find((p: StudentPlan) =>
                        p.activo && (p.disciplina === classSession.type || classSession.type.includes(p.disciplina) || p.disciplina === 'General')
                    );
                    if (plan) plan.creditos += 1;
                }
            }
            classSession.attendees = classSession.attendees.filter((a: Attendee) => a.studentId !== studentId);
            db.save(state);
        }
    },

    // Helper: Check Availability
    checkAvailability: (personId: string, date: string, startTime: string, type: 'instructor' | 'student', excludeClassId?: string): boolean => {
        const state = db.getAll();
        const classes = state.classes || [];

        const conflict = classes.find((c: ClassSession) => {
            if (c.status === 'cancelled') return false;
            if (excludeClassId && c.id === excludeClassId) return false;

            if (c.date !== date || c.startTime !== startTime) return false;

            if (type === 'instructor') {
                return c.instructorId === personId;
            } else {
                return c.attendees.some((a: Attendee) => a.studentId === personId && a.status === 'booked');
            }
        });

        return !conflict;
    },

    checkRoomAvailability: (roomId: string, date: string, startTime: string, excludeClassId?: string): boolean => {
        const state = db.getAll();
        const classes = state.classes || [];

        const conflict = classes.find((c: ClassSession) => {
            if (c.status === 'cancelled') return false;
            if (excludeClassId && c.id === excludeClassId) return false;
            return c.date === date && c.startTime === startTime && c.room === roomId;
        });

        return !conflict;
    },

    // Settings
    getSettings: () => db.getAll().settings,
    updateDisciplineRate: (discipline: string, data: { privateRate: number, rates: { min: number, max: number | null, price: number }[] }) => {
        const state = db.getAll();
        if (!state.settings) state.settings = { disciplineRates: {} };
        if (!state.settings.disciplineRates) state.settings.disciplineRates = {};
        state.settings.disciplineRates[discipline] = data;
        db.save(state);
    },
    updateRoomDisciplines: (roomId: string, disciplines: string[]) => {
        const state = db.getAll();
        if (!state.settings) state.settings = { disciplineRates: {} };
        if (!state.settings.roomDisciplines) state.settings.roomDisciplines = {};
        state.settings.roomDisciplines[roomId] = disciplines;
        db.save(state);
    },

    // Instructor Payments
    getInstructorPayments: (instructorId?: string) => {
        const payments = db.getAll().instructorPayments || [];
        if (instructorId) {
            return payments.filter(p => p.instructorId === instructorId);
        }
        return payments;
    },

    addInstructorPayment: (payment: Omit<InstructorPayment, 'id'>) => {
        const state = db.getAll();
        if (!state.instructorPayments) state.instructorPayments = [];

        const newPayment: InstructorPayment = {
            ...payment,
            id: `pay-${Date.now()}`
        };

        state.instructorPayments.push(newPayment);

        // Marcar las clases como pagadas
        state.classes.forEach(c => {
            if (newPayment.classIds.includes(c.id)) {
                c.paymentId = newPayment.id;
            }
        });

        db.save(state);
        return newPayment;
    },

    deleteInstructorPayment: (id: string) => {
        const state = db.getAll();
        if (state.instructorPayments) {
            state.instructorPayments = state.instructorPayments.filter(p => p.id !== id);

            // Desmarcar las clases vinculadas
            state.classes.forEach(c => {
                if (c.paymentId === id) {
                    delete c.paymentId;
                }
            });

            db.save(state);
        }
    }
};
