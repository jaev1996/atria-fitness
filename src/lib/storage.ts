// Tipos básicos
export type HistoryEntry = {
    id: string;
    date: string;
    treatment: string;
    notes: string;
    cost: number;
};

export type ToothStatus = 'healthy' | 'caries' | 'filled';

export type ToothState = {
    id: number;
    faces: {
        center: ToothStatus;
        top: ToothStatus;
        bottom: ToothStatus;
        left: ToothStatus;
        right: ToothStatus;
    };
    status: 'present' | 'missing';
    notes?: string;
};

export type Patient = {
    id: string;
    name: string;
    email: string;
    phone: string;
    history: HistoryEntry[];
    odontogram?: Record<number, ToothState>;
};

export type AppointmentStatus = 'scheduled' | 'postponed' | 'cancelled' | 'completed';

export type Appointment = {
    id: string;
    patientId: string;
    patientName: string;
    date: string; // ISO String or YYYY-MM-DD
    startTime: string; // "09:00"
    endTime: string;   // "10:00"
    status: AppointmentStatus;
    treatmentType: string;
    notes?: string;
};

const STORAGE_KEY = 'dental_cloud_data';

export const db = {
    // Obtener todo el estado
    getAll: () => {
        if (typeof window === 'undefined') return { patients: [], appointments: [] };
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
            patients: [
                { id: "1", name: "Juan Pérez", email: "juan@example.com", phone: "555-0101", history: [] },
                { id: "2", name: "Maria Garcia", email: "maria@example.com", phone: "555-0102", history: [] },
                { id: "3", name: "Carlos López", email: "carlos@example.com", phone: "555-0103", history: [] }
            ],
            appointments: [
                {
                    id: "101",
                    patientId: "1",
                    patientName: "Juan Pérez",
                    date: new Date().toISOString().split('T')[0],
                    startTime: "09:00",
                    endTime: "10:00",
                    status: "scheduled",
                    treatmentType: "Limpieza",
                    notes: "Primera visita"
                },
                {
                    id: "102",
                    patientId: "2",
                    patientName: "Maria Garcia",
                    date: new Date().toISOString().split('T')[0],
                    startTime: "11:00",
                    endTime: "12:00",
                    status: "scheduled",
                    treatmentType: "Revisión",
                    notes: "Dolor en muela"
                }
            ]
        };
        db.save(initialData); // This will also dispatch event
        return initialData;
    },

    // CRUD Pacientes
    getPatients: () => db.getAll().patients as Patient[],

    getPatient: (id: string) => {
        const patients = db.getPatients();
        return patients.find(p => p.id === id);
    },

    addPatient: (patient: Omit<Patient, 'id' | 'history'>) => {
        const state = db.getAll();
        if (!state.patients) state.patients = []; // Ensure patients array exists
        const newPatient = { ...patient, id: Date.now().toString(), history: [] };
        state.patients.push(newPatient);
        db.save(state);
        return newPatient;
    },

    deletePatient: (id: string) => {
        const state = db.getAll();
        if (state.patients) {
            state.patients = state.patients.filter((p: Patient) => p.id !== id);
            db.save(state);
        }
    },

    // Historial Clínico
    addHistoryEntry: (patientId: string, entry: Omit<HistoryEntry, 'id'>) => {
        const state = db.getAll();
        const patient = state.patients?.find((p: Patient) => p.id === patientId);
        if (patient) {
            patient.history.push({ ...entry, id: Date.now().toString() });
            db.save(state);
        }
    },

    deleteHistoryEntry: (patientId: string, entryId: string) => {
        const state = db.getAll();
        const patient = state.patients?.find((p: Patient) => p.id === patientId);
        if (patient) {
            patient.history = patient.history.filter((e: HistoryEntry) => e.id !== entryId);
            db.save(state);
        }
    },

    // CRUD Citas
    getAppointments: () => (db.getAll().appointments || []) as Appointment[],

    addAppointment: (appointment: Omit<Appointment, 'id'>) => {
        const state = db.getAll();
        if (!state.appointments) state.appointments = []; // Ensure appointments array exists
        const newAppointment = { ...appointment, id: Date.now().toString() };
        state.appointments.push(newAppointment);
        db.save(state);
        return newAppointment;
    },

    updateAppointmentStatus: (id: string, status: AppointmentStatus) => {
        const state = db.getAll();
        if (state.appointments) {
            const appointment = state.appointments.find((a: Appointment) => a.id === id);
            if (appointment) {
                appointment.status = status;
                db.save(state);
            }
        }
    },

    deleteAppointment: (id: string) => {
        const state = db.getAll();
        if (state.appointments) {
            state.appointments = state.appointments.filter((a: Appointment) => a.id !== id);
            db.save(state);
        }
    }
};
