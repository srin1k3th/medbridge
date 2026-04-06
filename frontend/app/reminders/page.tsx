'use client'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import BottomNav from '@/components/BottomNav'
import ScreenHeader from '@/components/ScreenHeader'
import { getReminders, addReminder, toggleReminder, deleteReminder } from '@/lib/api'
import { getProfile } from '@/lib/auth'

export default function RemindersPage() {
  const router = useRouter()
  const apptDateRef = useRef<HTMLInputElement>(null)
  const [reminders, setReminders] = useState<any[]>([])
  const [profile, setProfile] = useState<any>(null)
  const [drug, setDrug] = useState('')
  const [time, setTime] = useState('08:00')
  const [dose, setDose] = useState('')

  const [activeTab, setActiveTab] = useState<'medicine' | 'appointment'>('medicine')
  const [apptDoctor, setApptDoctor] = useState('')
  const [apptLocation, setApptLocation] = useState('')
  const [apptTime, setApptTime] = useState('10:00')

  const todayString = new Date().toISOString().split('T')[0]
  const [apptDate, setApptDate] = useState(todayString)

  const formatToDDMMYY = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yy = String(d.getFullYear()).slice(-2);
    return `${dd}/${mm}/${yy}`;
  };

  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  useEffect(() => { load(); getProfile().then(setProfile).catch(() => { }) }, [])

  async function load() { getReminders().then(setReminders).catch(() => { }) }

  async function toggle(id: string, done: boolean) {
    await toggleReminder(id, !done).catch(() => { }); load()
  }

  async function remove(id: string) {
    setDeleteId(id)
    setIsDeleting(true)
  }

  async function confirmDelete() {
    if (!deleteId) return
    await deleteReminder(deleteId).catch(() => { })
    setIsDeleting(false)
    setDeleteId(null)
    load()
  }

  function cancelDelete() {
    setIsDeleting(false)
    setDeleteId(null)
  }

  async function add() {
    if (activeTab === 'medicine') {
      if (!drug || !time) return
      await addReminder(drug, dose || '1 dose', time).catch(() => { })
      setDrug(''); setDose('')
    } else {
      if (!apptDoctor || !apptTime || !apptDate) return
      await addReminder(`[APPT] ${apptDoctor}`, apptLocation || 'Clinic', apptTime, apptDate).catch(() => { })
      setApptDoctor(''); setApptLocation('')
    }
    load()
  }

  const meds = reminders.filter(r => !r.drug_name.startsWith('[APPT]') && r.date === todayString)

  const appts = reminders.filter(r => r.drug_name.startsWith('[APPT]'))

  const INP: React.CSSProperties = {
    width: '100%',
    padding: '15px 16px',
    border: '1px solid rgba(210, 190, 140, 0.25)',
    borderRadius: '12px',
    fontFamily: 'Plus Jakarta Sans, sans-serif',
    fontSize: '0.9rem',
    outline: 'none',
    background: 'rgba(230, 210, 160, 0.08)',
    color: 'rgba(255,255,255,0.75)',
    boxSizing: 'border-box',
  }

  const LBL: React.CSSProperties = {
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: '0.58rem',
    textTransform: 'uppercase',
    letterSpacing: '0.12em',
    color: 'rgba(255,255,255,0.38)',
    marginBottom: '8px',
    display: 'block',
  }

  const SEC: React.CSSProperties = {
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: '0.58rem',
    textTransform: 'uppercase',
    letterSpacing: '0.12em',
    color: 'rgba(255,255,255,0.38)',
    marginBottom: '14px',
  }

  return (
    <div style={{ width: '430px', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <ScreenHeader title="Reminders & History" back="/home" />
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 12px 0', paddingBottom: '96px' }}>

        {meds.length > 0 && (
          <div style={{ marginBottom: '24px' }}>
            <div style={{ ...SEC, marginBottom: '12px' }}>Today's Medications</div>
            {meds.map(r => (
              <div
                key={r.id}
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  backdropFilter: 'blur(16px)',
                  WebkitBackdropFilter: 'blur(16px)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '14px', padding: '13px 15px',
                  marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '12px',
                }}
              >
                <div style={{
                  fontFamily: 'JetBrains Mono, monospace', fontSize: '0.72rem', fontWeight: 600,
                  color: r.is_done ? '#00C9A7' : '#FF7B7F',
                  background: r.is_done ? 'rgba(0,201,167,0.12)' : 'rgba(255,90,95,0.12)',
                  border: `1px solid ${r.is_done ? 'rgba(0,201,167,0.3)' : 'rgba(255,90,95,0.25)'}`,
                  padding: '5px 10px', borderRadius: '8px',
                  whiteSpace: 'nowrap', flexShrink: 0,
                }}>
                  {r.time_of_day?.slice(0, 5)}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'rgba(255,255,255,0.92)' }}>{r.drug_name}</div>
                  <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.38)', marginTop: '2px' }}>{r.dose}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div
                    onClick={() => toggle(r.id, r.is_done)}
                    style={{
                      width: '26px', height: '26px', borderRadius: '50%',
                      border: `2px solid ${r.is_done ? '#00C9A7' : 'rgba(255,255,255,0.2)'}`,
                      background: r.is_done ? '#00C9A7' : 'transparent',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '0.72rem', color: '#fff', flexShrink: 0,
                      boxShadow: r.is_done ? '0 0 10px rgba(0,201,167,0.4)' : 'none',
                      transition: 'all 0.2s',
                    }}
                  >{r.is_done ? '✓' : ''}</div>
                  <button
                    onClick={() => remove(r.id)}
                    style={{
                      background: 'rgba(255,90,95,0.1)',
                      border: '1px solid rgba(255,90,95,0.2)',
                      color: '#FF7B7F',
                      width: '26px', height: '26px', borderRadius: '8px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer', fontSize: '0.8rem',
                    }}
                    title="Delete"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2M10 11v6M14 11v6" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {appts.length > 0 && (
          <div style={{ marginBottom: '24px' }}>
            <div style={{ ...SEC, marginBottom: '12px' }}>Upcoming Appointments</div>
            {appts.map(r => (
              <div
                key={r.id}
                style={{
                  background: 'rgba(255,255,255,0.07)',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '16px',
                  padding: '16px',
                  marginBottom: '12px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  opacity: r.is_done ? 0.6 : 1,
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{
                    fontFamily: 'JetBrains Mono, monospace', fontSize: '0.55rem',
                    textTransform: 'uppercase', letterSpacing: '0.12em',
                    color: 'rgba(255,255,255,0.35)', marginBottom: '6px',
                  }}>Appointment</div>
                  <div style={{
                    fontFamily: 'Plus Jakarta Sans, sans-serif',
                    fontSize: '1.05rem', fontWeight: 700,
                    color: r.is_done ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.95)', marginBottom: '4px',
                  }}>
                    {r.drug_name.replace('[APPT] ', '')}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.45)', marginBottom: '4px' }}>
                    {r.dose} 
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)', marginTop: '4px' }}>
                    {r.date === todayString ? 'Today' : (() => {
                      const d = new Date(r.date);
                      const dd = String(d.getDate()).padStart(2, '0');
                      const mm = String(d.getMonth() + 1).padStart(2, '0');
                      const yy = String(d.getFullYear()).slice(-2);
                      return `${dd}/${mm}/${yy}`;
                    })()} at <span style={{ color: r.is_done ? '#00C9A7' : '#FF7B7F', fontWeight: 600 }}>{r.time_of_day?.slice(0, 5)}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                  <div style={{
                    background: r.is_done ? 'rgba(0,201,167,0.15)' : 'rgba(255,90,95,0.2)',
                    border: `1px solid ${r.is_done ? 'rgba(0,201,167,0.3)' : 'rgba(255,90,95,0.45)'}`,
                    color: r.is_done ? '#00C9A7' : '#FF7B7F',
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: '0.58rem',
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    padding: '6px 12px',
                    borderRadius: '8px',
                    fontWeight: 700,
                  }}>
                    {r.is_done ? 'Completed' : 'Upcoming'}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div
                      onClick={() => toggle(r.id, r.is_done)}
                      style={{
                        width: '26px', height: '26px', borderRadius: '50%',
                        border: `2px solid ${r.is_done ? '#00C9A7' : 'rgba(255,255,255,0.2)'}`,
                        background: r.is_done ? '#00C9A7' : 'transparent',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '0.72rem', color: '#fff', flexShrink: 0,
                        boxShadow: r.is_done ? '0 0 10px rgba(0,201,167,0.4)' : 'none',
                        transition: 'all 0.2s',
                        marginTop: '4px'
                      }}
                    >{r.is_done ? '✓' : ''}</div>

                    <button
                      onClick={() => remove(r.id)}
                      style={{
                        marginTop: '4px',
                        background: 'rgba(255,90,95,0.1)',
                        border: '1px solid rgba(255,90,95,0.2)',
                        color: '#FF7B7F',
                        width: '26px', height: '26px', borderRadius: '8px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', fontSize: '0.8rem',
                      }}
                      title="Delete"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2M10 11v6M14 11v6" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ ...SEC, marginTop: '12px' }}>Add Reminder</div>

        <div style={{ display: 'flex', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '4px', marginBottom: '20px' }}>
          <div
            onClick={() => setActiveTab('medicine')}
            style={{
              flex: 1, padding: '10px', textAlign: 'center', borderRadius: '8px', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600,
              background: activeTab === 'medicine' ? 'rgba(255,255,255,0.15)' : 'transparent',
              color: activeTab === 'medicine' ? '#fff' : 'rgba(255,255,255,0.4)',
              transition: 'all 0.2s',
            }}
          >Medicine</div>
          <div
            onClick={() => setActiveTab('appointment')}
            style={{
              flex: 1, padding: '10px', textAlign: 'center', borderRadius: '8px', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600,
              background: activeTab === 'appointment' ? 'rgba(255,255,255,0.15)' : 'transparent',
              color: activeTab === 'appointment' ? '#fff' : 'rgba(255,255,255,0.4)',
              transition: 'all 0.2s',
            }}
          >Appointment</div>
        </div>

        {activeTab === 'medicine' ? (
          <div className="fade-in">
            <div style={{ marginBottom: '16px' }}>
              <label style={LBL}>Medicine Name</label>
              <input
                style={INP}
                placeholder="e.g. Metformin 500mg"
                value={drug}
                onChange={e => setDrug(e.target.value)}
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={LBL}>Time</label>
              <input
                style={{ ...INP, colorScheme: 'dark' }}
                type="time"
                value={time}
                onChange={e => setTime(e.target.value)}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={LBL}>Dose</label>
              <input
                style={INP}
                placeholder="e.g. 1 tablet with food"
                value={dose}
                onChange={e => setDose(e.target.value)}
              />
            </div>
          </div>
        ) : (
          <div className="fade-in">
            <div style={{ marginBottom: '16px' }}>
              <label style={LBL}>Appointment With</label>
              <input
                style={INP}
                placeholder="e.g. Dr. Suresh Patel"
                value={apptDoctor}
                onChange={e => setApptDoctor(e.target.value)}
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={LBL}>Date</label>
              <div
                style={{ position: 'relative', cursor: 'pointer' }}
                onClick={() => {
                  try {
                    apptDateRef.current?.showPicker()
                  } catch (e) {
                    apptDateRef.current?.click()
                  }
                }}
              >
                <input
                  style={INP}
                  type="text"
                  readOnly
                  value={formatToDDMMYY(apptDate)}
                />
                <input
                  ref={apptDateRef}
                  type="date"
                  style={{
                    position: 'absolute',
                    opacity: 0,
                    inset: 0,
                    width: '100%',
                    height: '100%',
                    cursor: 'pointer',
                    colorScheme: 'dark',
                    pointerEvents: 'none' 
                  }}
                  value={apptDate}
                  onChange={e => setApptDate(e.target.value)}
                />
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={LBL}>Time</label>
              <input
                style={{ ...INP, colorScheme: 'dark' }}
                type="time"
                value={apptTime}
                onChange={e => setApptTime(e.target.value)}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={LBL}>Location / Notes</label>
              <input
                style={INP}
                placeholder="e.g. City Hospital, Room 204"
                value={apptLocation}
                onChange={e => setApptLocation(e.target.value)}
              />
            </div>
          </div>
        )}

        <button
          onClick={add}
          disabled={(activeTab === 'medicine' && (!drug || !time)) || (activeTab === 'appointment' && (!apptDoctor || !apptTime))}
          style={{
            width: '100%',
            padding: '17px',
            background: activeTab === 'medicine' ? 'linear-gradient(135deg, #FF5A5F, #E04449)' : 'linear-gradient(135deg, #00C9A7, #00A88E)',
            color: 'rgba(255,255,255,0.92)',
            border: 'none',
            borderRadius: '14px',
            fontFamily: 'Plus Jakarta Sans, sans-serif',
            fontSize: '0.95rem',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            boxShadow: activeTab === 'medicine' ? '0 4px 20px rgba(255, 90, 95, 0.4)' : '0 4px 20px rgba(0, 201, 167, 0.4)',
            marginBottom: '8px',
            opacity: ((activeTab === 'medicine' && (!drug || !time)) || (activeTab === 'appointment' && (!apptDoctor || !apptTime))) ? 0.5 : 1,
            transition: 'all 0.3s',
          }}
        >
          Add {activeTab === 'medicine' ? 'Medicine' : 'Appointment'}
        </button>

      </div>
      <BottomNav />

      {isDeleting && (
        <div style={{
          position: 'fixed', top: 0, left: '50%', transform: 'translateX(-50%)',
          width: '430px', height: '100%',
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div style={{
            width: '320px', background: 'rgba(30,30,35,0.95)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '24px', padding: '24px',
            textAlign: 'center', boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
          }}>
            <div style={{
              width: '50px', height: '50px', borderRadius: '50%',
              background: 'rgba(255,90,95,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 16px', color: '#FF7B7F',
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2M10 11v6M14 11v6" />
              </svg>
            </div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff', marginBottom: '8px' }}>Are you sure?</div>
            <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)', marginBottom: '24px', lineHeight: 1.5 }}>
              This action cannot be undone. This reminder will be permanently removed.
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={cancelDelete}
                style={{
                  flex: 1, padding: '12px', borderRadius: '14px',
                  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                  color: 'rgba(255,255,255,0.7)', fontSize: '0.9rem', fontWeight: 600,
                  cursor: 'pointer',
                }}
              >Cancel</button>
              <button
                onClick={confirmDelete}
                style={{
                  flex: 1, padding: '12px', borderRadius: '14px',
                  background: 'linear-gradient(135deg, #FF5A5F, #E04449)',
                  border: 'none', color: '#fff', fontSize: '0.9rem', fontWeight: 700,
                  cursor: 'pointer', boxShadow: '0 8px 16px rgba(255,90,95,0.3)',
                }}
              >Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
