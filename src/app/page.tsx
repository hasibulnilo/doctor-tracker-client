'use client';
import { useEffect, useMemo, useState } from 'react';
import { Activity, BarChart3, LayoutDashboard, LogOut, Pencil, Plus, Search, Stethoscope, Trash2, Users } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import api from '@/lib/api';

type Doctor = {
  _id: string;
  name: string;
  specialization: string;
  hospital: string;
  phone: string;
  email: string;
};

type Patient = {
  _id: string;
  name: string;
  age: number;
  gender: string;
  phone: string;
  condition: string;
  doctor?: { _id?: string; name: string; specialization?: string };
  createdAt?: string;
};

type Meta = { total: number; page: number; limit: number; totalPages: number };

type DashboardStats = {
  totalDoctors: number;
  totalPatients: number;
  patientsPerDoctor: Array<{ doctorId: string; doctorName: string; patients: number }>;
  monthlyPatients: Array<{ _id: string; count: number }>;
};

const defaultDoctorForm = { name: '', specialization: '', hospital: '', phone: '', email: '' };
const defaultPatientForm = { name: '', age: 0, gender: 'male', phone: '', condition: '', doctorId: '' };

export default function Home() {
  const [token, setToken] = useState('');
  const [email, setEmail] = useState('admin@example.com');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [tab, setTab] = useState('dashboard');

  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [doctorMeta, setDoctorMeta] = useState<Meta | null>(null);
  const [patientMeta, setPatientMeta] = useState<Meta | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);

  const [doctorSearch, setDoctorSearch] = useState('');
  const [patientSearch, setPatientSearch] = useState('');
  const [doctorPage, setDoctorPage] = useState(1);
  const [patientPage, setPatientPage] = useState(1);

  const [doctorFilters, setDoctorFilters] = useState({ specialization: '', from: '', to: '' });
  const [patientFilters, setPatientFilters] = useState({ condition: '', doctorId: '', from: '', to: '' });

  const [doctorForm, setDoctorForm] = useState(defaultDoctorForm);
  const [patientForm, setPatientForm] = useState(defaultPatientForm);
  const [showDoctor, setShowDoctor] = useState(false);
  const [showPatient, setShowPatient] = useState(false);
  const [editingDoctorId, setEditingDoctorId] = useState<string | null>(null);
  const [editingPatientId, setEditingPatientId] = useState<string | null>(null);

  useEffect(() => {
    const storedToken = localStorage.getItem('doctor_tracker_token');
    if (storedToken) setToken(storedToken);
  }, []);

  const loadData = async () => {
    if (!token) return;

    try {
      const [doctorRes, patientRes, dashboardRes] = await Promise.all([
        api.get('/doctors', {
          params: {
            page: doctorPage,
            limit: 6,
            search: doctorSearch,
            specialization: doctorFilters.specialization || undefined,
            from: doctorFilters.from || undefined,
            to: doctorFilters.to || undefined,
          },
        }),
        api.get('/patients', {
          params: {
            page: patientPage,
            limit: 6,
            search: patientSearch,
            condition: patientFilters.condition || undefined,
            doctorId: patientFilters.doctorId || undefined,
            from: patientFilters.from || undefined,
            to: patientFilters.to || undefined,
          },
        }),
        api.get('/dashboard'),
      ]);

      setDoctors(doctorRes.data.data ?? []);
      setDoctorMeta(doctorRes.data.meta ?? null);
      setPatients(patientRes.data.data ?? []);
      setPatientMeta(patientRes.data.meta ?? null);
      setStats(dashboardRes.data ?? null);
      setError('');
    } catch (e: any) {
      if (e.response?.status === 401) {
        logout();
        return;
      }
      setError(e.response?.data?.message || 'Could not load data');
    }
  };

  useEffect(() => {
    if (token) {
      loadData();
    }
  }, [token, tab, doctorPage, patientPage, doctorSearch, patientSearch, doctorFilters, patientFilters]);

  const monthlyChartData = useMemo(
    () =>
      (stats?.monthlyPatients ?? []).map((item) => ({
        month: item._id,
        patients: item.count,
      })),
    [stats],
  );

  function logout() {
    localStorage.removeItem('doctor_tracker_token');
    setToken('');
    setStats(null);
    setDoctors([]);
    setPatients([]);
  }

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      const response = await api.post('/auth/login', { email, password });
      localStorage.setItem('doctor_tracker_token', response.data.accessToken);
      setToken(response.data.accessToken);
    } catch (e: any) {
      setError(e.response?.data?.message || 'Login failed');
    }
  }

  async function submitDoctor(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (editingDoctorId) {
        await api.patch(`/doctors/${editingDoctorId}`, doctorForm);
      } else {
        await api.post('/doctors', doctorForm);
      }

      setShowDoctor(false);
      setEditingDoctorId(null);
      setDoctorForm(defaultDoctorForm);
      setDoctorPage(1);
      await loadData();
    } catch (e: any) {
      setError(e.response?.data?.message || 'Could not save doctor');
    }
  }

  async function submitPatient(e: React.FormEvent) {
    e.preventDefault();
    try {
      const payload = {
        ...patientForm,
        age: Number(patientForm.age),
        doctorId: patientForm.doctorId || doctors[0]?._id,
      };

      if (editingPatientId) {
        await api.patch(`/patients/${editingPatientId}`, payload);
      } else {
        await api.post('/patients', payload);
      }

      setShowPatient(false);
      setEditingPatientId(null);
      setPatientForm(defaultPatientForm);
      setPatientPage(1);
      await loadData();
    } catch (e: any) {
      setError(e.response?.data?.message || 'Could not save patient');
    }
  }

  async function del(url: string) {
    if (!window.confirm('Are you sure you want to delete this record?')) return;

    try {
      await api.delete(url);
      await loadData();
    } catch (e: any) {
      setError(e.response?.data?.message || 'Delete failed');
    }
  }

  const openDoctorModal = (doctor?: Doctor) => {
    if (doctor) {
      setEditingDoctorId(doctor._id);
      setDoctorForm({
        name: doctor.name,
        specialization: doctor.specialization,
        hospital: doctor.hospital,
        phone: doctor.phone,
        email: doctor.email,
      });
    } else {
      setEditingDoctorId(null);
      setDoctorForm(defaultDoctorForm);
    }
    setShowDoctor(true);
  };

  const openPatientModal = (patient?: Patient) => {
    if (patient) {
      setEditingPatientId(patient._id);
      setPatientForm({
        name: patient.name,
        age: patient.age,
        gender: patient.gender,
        phone: patient.phone,
        condition: patient.condition,
        doctorId: patient.doctor?._id || '',
      });
    } else {
      setEditingPatientId(null);
      setPatientForm({ ...defaultPatientForm, doctorId: doctors[0]?._id || '' });
    }
    setShowPatient(true);
  };

  if (!token) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-100 p-5">
        <form onSubmit={login} className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
          <div className="mb-6 flex items-center gap-3">
            <div className="rounded-xl bg-blue-600 p-3 text-white"><Stethoscope /></div>
            <div>
              <h1 className="text-2xl font-bold">Doctor Tracker</h1>
              <p className="text-sm text-slate-500">Admin portal sign in</p>
            </div>
          </div>

          {error && <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

          <label className="mb-2 block text-sm font-medium">Email</label>
          <input className="mb-4 w-full rounded-lg border p-3" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />

          <label className="mb-2 block text-sm font-medium">Password</label>
          <input className="mb-6 w-full rounded-lg border p-3" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />

          <button className="w-full rounded-lg bg-blue-600 p-3 font-semibold text-white hover:bg-blue-700">Sign in</button>
          <p className="mt-4 text-xs text-slate-500">Use the seeded admin credentials from the backend environment file.</p>
        </form>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 md:flex">
      <aside className="bg-slate-950 p-5 text-white md:min-h-screen md:w-64">
        <div className="mb-9 flex items-center gap-3 text-lg font-bold">
          <Stethoscope className="text-cyan-400" />
          Doctor Tracker
        </div>

        <nav className="space-y-2">
          {[
            ['dashboard', 'Dashboard', LayoutDashboard],
            ['doctors', 'Doctors', Stethoscope],
            ['patients', 'Patients', Users],
          ].map(([id, label, Icon]: any) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left ${tab === id ? 'bg-blue-600' : 'text-slate-300 hover:bg-slate-800'}`}
            >
              <Icon size={18} />
              {label}
            </button>
          ))}
        </nav>

        <button onClick={logout} className="mt-10 flex items-center gap-3 px-4 py-3 text-slate-300">
          <LogOut size={18} />
          Sign out
        </button>
      </aside>

      <main className="min-w-0 flex-1 p-5 md:p-9">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm text-slate-500">Overview / {tab}</p>
            <h1 className="mt-1 text-3xl font-bold capitalize">{tab}</h1>
          </div>
          <div className="flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm shadow-sm">
            <span className="h-2 w-2 rounded-full bg-green-500" /> Admin
          </div>
        </header>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {error}
            <button onClick={() => setError('')} className="float-right">×</button>
          </div>
        )}

        {tab === 'dashboard' && (
          <>
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {[
                { label: 'Total Doctors', value: stats?.totalDoctors ?? '—', icon: Stethoscope },
                { label: 'Total Patients', value: stats?.totalPatients ?? '—', icon: Users },
                { label: 'Monthly Growth', value: monthlyChartData.at(-1)?.patients ?? '—', icon: Activity },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl bg-white p-6 shadow-sm">
                  <div className="flex items-center justify-between text-slate-500">
                    <span>{item.label}</span>
                    <item.icon className="text-blue-600" />
                  </div>
                  <p className="mt-4 text-3xl font-bold">{item.value}</p>
                </div>
              ))}
            </section>

            <section className="mt-7 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
              <div className="rounded-2xl bg-white p-6 shadow-sm">
                <div className="mb-4 flex items-center gap-2">
                  <BarChart3 className="text-blue-600" size={18} />
                  <h2 className="text-lg font-bold">Patients per doctor</h2>
                </div>

                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats?.patientsPerDoctor ?? []}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="doctorName" tick={{ fontSize: 12 }} />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="patients" fill="#2563eb" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="rounded-2xl bg-white p-6 shadow-sm">
                <div className="mb-4 flex items-center gap-2">
                  <Activity className="text-blue-600" size={18} />
                  <h2 className="text-lg font-bold">Monthly admissions</h2>
                </div>

                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="patients" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </section>
          </>
        )}

        {tab !== 'dashboard' && (
          <>
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-white px-3">
                <Search size={17} className="text-slate-400" />
                <input
                  className="w-56 py-2 outline-none"
                  placeholder={`Search ${tab}...`}
                  value={tab === 'doctors' ? doctorSearch : patientSearch}
                  onChange={(e) => (tab === 'doctors' ? setDoctorSearch(e.target.value) : setPatientSearch(e.target.value))}
                />
              </div>

              <button
                onClick={() => (tab === 'doctors' ? openDoctorModal() : openPatientModal())}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white"
              >
                <Plus size={17} />
                Add {tab === 'doctors' ? 'Doctor' : 'Patient'}
              </button>
            </div>

            {tab === 'doctors' ? (
              <div className="mb-4 rounded-xl bg-white p-4 shadow-sm">
                <div className="grid gap-3 md:grid-cols-3">
                  <input
                    className="rounded-lg border p-2"
                    placeholder="Specialization"
                    value={doctorFilters.specialization}
                    onChange={(e) => setDoctorFilters((prev) => ({ ...prev, specialization: e.target.value }))}
                  />
                  <input type="date" className="rounded-lg border p-2" value={doctorFilters.from} onChange={(e) => setDoctorFilters((prev) => ({ ...prev, from: e.target.value }))} />
                  <input type="date" className="rounded-lg border p-2" value={doctorFilters.to} onChange={(e) => setDoctorFilters((prev) => ({ ...prev, to: e.target.value }))} />
                </div>
              </div>
            ) : (
              <div className="mb-4 rounded-xl bg-white p-4 shadow-sm">
                <div className="grid gap-3 md:grid-cols-4">
                  <input
                    className="rounded-lg border p-2"
                    placeholder="Condition"
                    value={patientFilters.condition}
                    onChange={(e) => setPatientFilters((prev) => ({ ...prev, condition: e.target.value }))}
                  />
                  <select className="rounded-lg border p-2" value={patientFilters.doctorId} onChange={(e) => setPatientFilters((prev) => ({ ...prev, doctorId: e.target.value }))}>
                    <option value="">All doctors</option>
                    {doctors.map((doctor) => (
                      <option key={doctor._id} value={doctor._id}>{doctor.name}</option>
                    ))}
                  </select>
                  <input type="date" className="rounded-lg border p-2" value={patientFilters.from} onChange={(e) => setPatientFilters((prev) => ({ ...prev, from: e.target.value }))} />
                  <input type="date" className="rounded-lg border p-2" value={patientFilters.to} onChange={(e) => setPatientFilters((prev) => ({ ...prev, to: e.target.value }))} />
                </div>
              </div>
            )}

            {tab === 'doctors' ? (
              <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
                <table className="w-full min-w-[900px] text-left text-sm">
                  <thead className="bg-slate-50 text-slate-500">
                    <tr>
                      {['Name', 'Specialization', 'Hospital', 'Phone', 'Email', 'Actions'].map((heading) => (
                        <th key={heading} className="p-4 font-medium">{heading}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {doctors.map((doctor) => (
                      <tr key={doctor._id} className="border-t">
                        <td className="p-4 font-semibold">{doctor.name}</td>
                        <td className="p-4">{doctor.specialization}</td>
                        <td className="p-4">{doctor.hospital}</td>
                        <td className="p-4">{doctor.phone}</td>
                        <td className="p-4">{doctor.email}</td>
                        <td className="p-4">
                          <div className="flex gap-2">
                            <button onClick={() => openDoctorModal(doctor)} className="text-blue-600"><Pencil size={17} /></button>
                            <button onClick={() => del(`/doctors/${doctor._id}`)} className="text-red-500"><Trash2 size={17} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {!doctors.length && <p className="p-8 text-center text-slate-500">No doctors found.</p>}

                {doctorMeta && doctorMeta.totalPages > 1 && (
                  <div className="flex justify-end gap-2 p-4">
                    <button disabled={doctorPage === 1} onClick={() => setDoctorPage((p) => Math.max(1, p - 1))} className="rounded border px-3 py-1 disabled:opacity-50">Prev</button>
                    <span className="px-2 py-1 text-sm">Page {doctorMeta.page} / {doctorMeta.totalPages}</span>
                    <button disabled={doctorPage >= doctorMeta.totalPages} onClick={() => setDoctorPage((p) => p + 1)} className="rounded border px-3 py-1 disabled:opacity-50">Next</button>
                  </div>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
                <table className="w-full min-w-[850px] text-left text-sm">
                  <thead className="bg-slate-50 text-slate-500">
                    <tr>
                      {['Name', 'Doctor', 'Condition', 'Phone', 'Age', 'Gender', 'Actions'].map((heading) => (
                        <th key={heading} className="p-4 font-medium">{heading}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {patients.map((patient) => (
                      <tr key={patient._id} className="border-t">
                        <td className="p-4 font-semibold">{patient.name}</td>
                        <td className="p-4">{patient.doctor?.name || '—'}</td>
                        <td className="p-4">{patient.condition}</td>
                        <td className="p-4">{patient.phone}</td>
                        <td className="p-4">{patient.age}</td>
                        <td className="p-4">{patient.gender}</td>
                        <td className="p-4">
                          <div className="flex gap-2">
                            <button onClick={() => openPatientModal(patient)} className="text-blue-600"><Pencil size={17} /></button>
                            <button onClick={() => del(`/patients/${patient._id}`)} className="text-red-500"><Trash2 size={17} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {!patients.length && <p className="p-8 text-center text-slate-500">No patients found.</p>}

                {patientMeta && patientMeta.totalPages > 1 && (
                  <div className="flex justify-end gap-2 p-4">
                    <button disabled={patientPage === 1} onClick={() => setPatientPage((p) => Math.max(1, p - 1))} className="rounded border px-3 py-1 disabled:opacity-50">Prev</button>
                    <span className="px-2 py-1 text-sm">Page {patientMeta.page} / {patientMeta.totalPages}</span>
                    <button disabled={patientPage >= patientMeta.totalPages} onClick={() => setPatientPage((p) => p + 1)} className="rounded border px-3 py-1 disabled:opacity-50">Next</button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>

      {showDoctor && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/50 p-3">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold">{editingDoctorId ? 'Edit Doctor' : 'Add Doctor'}</h2>
              <button onClick={() => setShowDoctor(false)} className="text-slate-500">✕</button>
            </div>

            <form onSubmit={submitDoctor} className="grid gap-3 sm:grid-cols-2">
              {[
                { key: 'name', label: 'Name' },
                { key: 'specialization', label: 'Specialization' },
                { key: 'hospital', label: 'Hospital' },
                { key: 'phone', label: 'Phone' },
                { key: 'email', label: 'Email' },
              ].map((field) => (
                <div key={field.key} className="sm:col-span-1">
                  <label className="mb-1 block text-sm font-medium">{field.label}</label>
                  <input
                    className="w-full rounded-lg border p-3"
                    value={doctorForm[field.key as keyof typeof doctorForm]}
                    onChange={(e) => setDoctorForm((prev) => ({ ...prev, [field.key]: e.target.value }))}
                    required
                  />
                </div>
              ))}

              <div className="sm:col-span-2 flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowDoctor(false)} className="rounded-lg border px-4 py-2">Cancel</button>
                <button type="submit" className="rounded-lg bg-blue-600 px-4 py-2 text-white">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showPatient && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/50 p-3">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold">{editingPatientId ? 'Edit Patient' : 'Add Patient'}</h2>
              <button onClick={() => setShowPatient(false)} className="text-slate-500">✕</button>
            </div>

            <form onSubmit={submitPatient} className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm font-medium">Name</label>
                <input className="w-full rounded-lg border p-3" value={patientForm.name} onChange={(e) => setPatientForm((prev) => ({ ...prev, name: e.target.value }))} required />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Age</label>
                <input type="number" min={0} className="w-full rounded-lg border p-3" value={patientForm.age} onChange={(e) => setPatientForm((prev) => ({ ...prev, age: Number(e.target.value) }))} required />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Gender</label>
                <select className="w-full rounded-lg border p-3" value={patientForm.gender} onChange={(e) => setPatientForm((prev) => ({ ...prev, gender: e.target.value }))}>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Phone</label>
                <input className="w-full rounded-lg border p-3" value={patientForm.phone} onChange={(e) => setPatientForm((prev) => ({ ...prev, phone: e.target.value }))} required />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Doctor</label>
                <select className="w-full rounded-lg border p-3" value={patientForm.doctorId} onChange={(e) => setPatientForm((prev) => ({ ...prev, doctorId: e.target.value }))} required>
                  <option value="">Select doctor</option>
                  {doctors.map((doctor) => (
                    <option key={doctor._id} value={doctor._id}>{doctor.name}</option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm font-medium">Condition</label>
                <input className="w-full rounded-lg border p-3" value={patientForm.condition} onChange={(e) => setPatientForm((prev) => ({ ...prev, condition: e.target.value }))} required />
              </div>

              <div className="sm:col-span-2 flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowPatient(false)} className="rounded-lg border px-4 py-2">Cancel</button>
                <button type="submit" className="rounded-lg bg-blue-600 px-4 py-2 text-white">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

