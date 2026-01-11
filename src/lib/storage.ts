import { RoomId, ROOMS, DISCIPLINES } from "@/constants/config";

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
    disciplina: string; // e.g. "Pole Sport", "Yoga", "General"
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
    ratePerClass?: number; // Costo por clase impartida
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
};

const STORAGE_KEY = 'atria_fitness_data';

export const db = {
    // Obtener todo el estado
    getAll: () => {
        if (typeof window === 'undefined') return { students: [], classes: [], instructors: [] };
        const data = localStorage.getItem(STORAGE_KEY);
        if (!data) {
            return db.seed();
        }
        return JSON.parse(data);
    },

    // Guardar estado
    save: (data: any) => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        window.dispatchEvent(new Event("storage-update"));
    },

    seed: () => {
        const initialData = {
            students: [],
            instructors: [
                { id: "i1", name: "Valentina", specialties: ["Pole Dance", "Glúteos"], email: "val@example.com", phone: "555-1111" },
                { id: "i2", name: "Camila", specialties: ["Telas", "Yoga"], email: "cam@example.com", phone: "555-2222" }
            ],
            classes: []
        };
        db.save(initialData);
        return initialData;
    },

    // CRUD Alumnas
    getStudents: () => db.getAll().students as Student[],

    getStudent: (id: string) => {
        const students = db.getStudents();
        return students.find(s => s.id === id);
    },

    addStudent: (student: Omit<Student, 'id' | 'history' | 'payments' | 'plans' | 'status'> & { planType: string, status?: StudentStatus }) => {
        const state = db.getAll();
        if (!state.students) state.students = [];

        const initialPlans: StudentPlan[] = [];
        if (student.planType) {
            let credits = 8;
            if (student.planType === 'Ilimitado') credits = 999;
            if (student.planType === 'Clase Suelta') credits = 1;
            if (student.planType === 'Pack 12 Clases') credits = 12;
            if (student.planType === 'Pack 4 Clases') credits = 4;
            if (student.planType === 'Sin Plan') credits = 0;

            initialPlans.push({
                id: Date.now().toString(),
                disciplina: "General",
                creditos: credits,
                activo: true,
                nombreOriginal: student.planType
            });
        }

        const newStudent = {
            ...student,
            id: Date.now().toString(),
            history: [],
            payments: [],
            plans: initialPlans,
            status: student.status || 'active'
        };
        // Clean up temp field
        delete (newStudent as any).planType;

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
        const index = state.students.findIndex((s: Student) => s.id === id);
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
    getInstructors: () => (db.getAll().instructors || []) as Instructor[],

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
    getClasses: () => (db.getAll().classes || []) as ClassSession[],

    addClass: (classSession: Omit<ClassSession, 'id' | 'attendees' | 'endTime'>) => {
        const state = db.getAll();
        if (!state.classes) state.classes = [];

        const [h, m] = classSession.startTime.split(':').map(Number);
        const endH = h + 1;
        const endTime = `${endH.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;

        const newClass = {
            ...classSession,
            id: Date.now().toString(),
            endTime,
            attendees: []
        };
        state.classes.push(newClass);
        db.save(state);
        return newClass;
    },

    updateClass: (classData: ClassSession) => {
        const state = db.getAll();
        if (state.classes) {
            const index = state.classes.findIndex((c: ClassSession) => c.id === classData.id);
            if (index !== -1) {
                const oldClass = state.classes[index];
                state.classes[index] = classData;

                // CHECK FOR COMPLETION LOGIC
                if (classData.status === 'completed' && oldClass.status !== 'completed') {
                    classData.attendees.forEach(attendee => {
                        if (attendee.status === 'booked' && !attendee.creditDeducted && attendee.attendanceType === 'standard') {
                            const studentIndex = state.students.findIndex((s: Student) => s.id === attendee.studentId);
                            if (studentIndex !== -1) {
                                const student = state.students[studentIndex];
                                let plan = student.plans?.find((p: StudentPlan) =>
                                    p.activo && (p.disciplina === classData.type || classData.type.includes(p.disciplina) || p.disciplina === 'General')
                                );

                                if (plan && plan.creditos > 0) {
                                    plan.creditos -= 1;
                                    attendee.creditDeducted = true;

                                    // Add to History automatically
                                    student.history.push({
                                        id: Date.now() + Math.random().toString(),
                                        date: new Date().toISOString().split('T')[0],
                                        activity: `Clase Completada: ${classData.type}`,
                                        notes: `Instructor: ${classData.instructorName}`,
                                        cost: 0
                                    });
                                }
                            }
                        }
                    });
                }
                db.save(state);
            }
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
                (p.disciplina === classSession.type || classSession.type.includes(p.disciplina) || p.disciplina === 'General')
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
                    let plan = student.plans?.find((p: StudentPlan) =>
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
    }
};
