import { RoomId, ROOMS } from "@/constants/config";

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
    ratePerClass?: number; // Costo por clase impartida (Deprecado - Usar tiers)
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
    const roomSettings = state.settings?.roomRates?.[classSession.room];

    // Si no hay settings guardados, intentar usar los estáticos de ROOMS
    const fallbackRoom = ROOMS.find(r => r.id === classSession.room);

    const privateRate = roomSettings?.privateRate ?? fallbackRoom?.privateRate ?? 25;
    const rates = roomSettings?.rates ?? fallbackRoom?.rates ?? [];

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
        roomRates: Record<string, {
            privateRate: number;
            rates: { min: number, max: number | null, price: number }[];
        }>;
    };
};

const STORAGE_KEY = 'atria_fitness_data_v2';

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
                { id: "s1", name: "Ana Martínez", email: "ana@example.com", phone: "555-0001", medicalInfo: "", allergies: "", injuries: "", conditions: "", emergencyContact: "", sportsInfo: "", status: "active", plans: [], payments: [], history: [] },
                { id: "s2", name: "Beatriz López", email: "beatriz@example.com", phone: "555-0002", medicalInfo: "", allergies: "", injuries: "", conditions: "", emergencyContact: "", sportsInfo: "", status: "active", plans: [], payments: [], history: [] },
                { id: "s3", name: "Carla García", email: "carla@example.com", phone: "555-0003", medicalInfo: "", allergies: "", injuries: "", conditions: "", emergencyContact: "", sportsInfo: "", status: "active", plans: [], payments: [], history: [] },
                { id: "s4", name: "Daniela Rivas", email: "daniela@example.com", phone: "555-0004", medicalInfo: "", allergies: "", injuries: "", conditions: "", emergencyContact: "", sportsInfo: "", status: "active", plans: [], payments: [], history: [] },
                { id: "s5", name: "Elena Torres", email: "elena@example.com", phone: "555-0005", medicalInfo: "", allergies: "", injuries: "", conditions: "", emergencyContact: "", sportsInfo: "", status: "guest", plans: [], payments: [], history: [] },
            ],
            instructors: [
                { id: "i1", name: "Valentina (Pole)", specialties: ["Pole Exotic"], email: "valentina@atria.com", phone: "555-1111" },
                { id: "i2", name: "Camila (Yoga)", specialties: ["Yoga"], email: "camila@atria.com", phone: "555-2222" },
                { id: "i3", name: "Sofía (Telas)", specialties: ["Telas"], email: "sofia@atria.com", phone: "555-3333" },
                { id: "i4", name: "Lucía (Glúteos)", specialties: ["Glúteos"], email: "lucia@atria.com", phone: "555-4444" },
                { id: "i5", name: "Andrea (Master)", specialties: ["Pole Exotic", "Yoga", "Telas", "Glúteos"], email: "andrea@atria.com", phone: "555-5555" }
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

    addStudent: (data: Omit<Student, 'id' | 'history' | 'payments' | 'plans' | 'status'> & { planType: string, status?: StudentStatus }) => {
        const state = db.getAll();
        const { planType, ...studentInfo } = data;

        const initialPlans: StudentPlan[] = [];
        if (planType) {
            let credits = 8;
            if (planType === 'Ilimitado') credits = 999;
            if (planType === 'Clase Suelta') credits = 1;
            if (planType === 'Pack 12 Clases') credits = 12;
            if (planType === 'Pack 4 Clases') credits = 4;
            if (planType === 'Sin Plan') credits = 0;

            initialPlans.push({
                id: Date.now().toString(),
                disciplina: "General",
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

        // Find if there is any class that conflicts
        const conflict = classes.find((c: ClassSession) => {
            if (c.status === 'cancelled') return false;
            if (excludeClassId && c.id === excludeClassId) return false;

            // Check Date & Time overlap
            if (c.date !== date || c.startTime !== startTime) return false;

            if (type === 'instructor') {
                return c.instructorId === personId;
            } else {
                return c.attendees.some((a: Attendee) => a.studentId === personId && a.status === 'booked');
            }
        });

        return !conflict; // Returns true if available (no conflict)
    },

    // Settings
    getSettings: () => db.getAll().settings,
    updateRoomRate: (roomId: string, data: { privateRate: number, rates: { min: number, max: number | null, price: number }[] }) => {
        const state = db.getAll();
        if (!state.settings) state.settings = { roomRates: {} };
        if (!state.settings.roomRates) state.settings.roomRates = {};
        state.settings.roomRates[roomId] = data;
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
