'use client'
import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import BottomNav from '@/components/BottomNav'
import ScreenHeader from '@/components/ScreenHeader'
import { getPrescriptions, deletePrescription, getDrugs, saveDrug, lookupDrug, parseVisitPrescription } from '@/lib/api'
import { supabase } from '@/lib/supabase'

type Prescription = {
  id: string
  drug_name: string
  dosage: string | null
  frequency: string | null
  duration: string | null
  notes: string | null
  created_at: string
}

type MedicationDetails = {
  drug_name: string
  dosage: string
  frequency: string
  duration: string
  notes: string
}

type VisitPrescription = {
  patientName: string
  patientAge: string
  reasonForVisit: string
  doctorName: string
  prescriptionDate: string
  medicines: MedicationDetails[]
}

const GLS: React.CSSProperties = {
  width: '100%', padding: '10px 13px',
  border: '1px solid rgba(255,255,255,0.12)', borderRadius: '10px',
  fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '0.82rem',
  outline: 'none', background: 'rgba(255,255,255,0.06)',
  color: 'rgba(255,255,255,0.9)',
}
const LBL: React.CSSProperties = {
  fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem',
  textTransform: 'uppercase', letterSpacing: '0.08em',
  color: 'rgba(255,255,255,0.35)', marginBottom: '6px', display: 'block',
}

async function extractTextFromPdf(file: File): Promise<string> {
  const pdfjsLib = await import('pdfjs-dist')
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  const texts: string[] = []

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    const pageText = content.items.map((item: any) => (item as any).str).join(' ')
    texts.push(pageText)
  }

  return texts.join('\n\n')
}

export default function PrescriptionsPage() {
  const searchParams = useSearchParams()
  const tab = searchParams.get('tab')
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const [showForm, setShowForm] = useState(false)
  const [formStep, setFormStep] = useState(1)
  const [adding, setAdding] = useState(false)

  const [patientName, setPatientName] = useState('')
  const [patientAge, setPatientAge] = useState('')
  const [reason, setReason] = useState('')
  const [doctorName, setDoctorName] = useState('')
  const prescriptionDateRef = useRef<HTMLInputElement>(null)
  const editDateRef = useRef<HTMLInputElement>(null)
  const [prescriptionDate, setPrescriptionDate] = useState(new Date().toISOString().split('T')[0])
  const [numMedicines, setNumMedicines] = useState('1')

  const [medicines, setMedicines] = useState<MedicationDetails[]>([])

  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [idToDelete, setIdToDelete] = useState<string | null>(null)

  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  const [viewingData, setViewingData] = useState<{ id: string, visit: VisitPrescription, created_at: string } | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [savingEdit, setSavingEdit] = useState(false)
  const [extracting, setExtracting] = useState(false)

  const [activeTab, setActiveTab] = useState<'history' | 'lookup'>('history')

  const [allDrugs, setAllDrugs] = useState<string[]>([])
  const [drugInput, setDrugInput] = useState('')
  const [selectedDrug, setSelectedDrug] = useState<string | null>(null)
  const [drugDetail, setDrugDetail] = useState<any>(null)
  const [drugLoading, setDrugLoading] = useState(false)

  function load() {
    setLoading(true)
    getPrescriptions()
      .then(setPrescriptions)
      .catch(() => setError(true))
      .finally(() => setLoading(false))

    getDrugs().then(d => setAllDrugs(d.map((x: any) => x.drug_name))).catch(() => { })
  }

  useEffect(() => { load() }, [])

  useEffect(() => {
    if (tab === 'lookup') {
      setActiveTab('lookup')
    }
  }, [tab])

  async function addDrugToLookup() {
    const v = drugInput.trim(); if (!v) return
    if (!allDrugs.includes(v)) { await saveDrug(v).catch(() => { }); setAllDrugs(p => [...p, v]) }
    setDrugInput(''); lookup(v)
  }

  async function lookup(name: string) {
    setSelectedDrug(name); setDrugDetail(null); setDrugLoading(true)
    try { setDrugDetail(await lookupDrug(name)) } catch { }
    setDrugLoading(false)
  }

  const INFO_ROWS = drugDetail ? [
    { label: 'What for', val: drugDetail.what_for, accent: '#A78BFA' },
    { label: 'How to take', val: drugDetail.how_to_take, accent: '#00C9A7' },
    { label: 'Side effects', val: drugDetail.side_effects, accent: '#FBBF24' },
    { label: 'Avoid', val: drugDetail.avoid, accent: '#FF5A5F' },
  ] : []

  function handleDelete(id: string) {
    setIdToDelete(id)
    setShowDeleteModal(true)
  }

  async function confirmDelete() {
    if (!idToDelete) return
    setDeletingId(idToDelete)
    setShowDeleteModal(false)
    try {
      await deletePrescription(idToDelete)
      setPrescriptions(prev => prev.filter(p => p.id !== idToDelete))
      if (viewingData?.id === idToDelete) setViewingData(null)
    } catch { }
    setDeletingId(null)
    setIdToDelete(null)
  }

  function cancelDelete() {
    setShowDeleteModal(false)
    setIdToDelete(null)
  }

  function handleNextStep() {
    const num = parseInt(numMedicines, 10) || 1
    if (medicines.length !== num) {
      setMedicines(Array.from({ length: num }, (_, i) => medicines[i] || { drug_name: '', dosage: '', frequency: '', duration: '', notes: '' }))
    }
    setFormStep(2)
  }

  function resetForm() {
    setPatientName(''); setPatientAge(''); setReason(''); setDoctorName(''); setPrescriptionDate('')
    setNumMedicines('1'); setMedicines([]); setFormStep(1); setShowForm(false)
  }

  async function handleAddVisit() {
    const validMeds = medicines.filter(m => m.drug_name.trim())
    if (validMeds.length === 0) return

    setAdding(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()

      const visitData: VisitPrescription = {
        patientName, patientAge, reasonForVisit: reason, doctorName, prescriptionDate, medicines: validMeds
      }

      await supabase.from('prescriptions').insert({
        user_id: user!.id,
        drug_name: 'Visit Prescription',
        notes: JSON.stringify(visitData),
      })
      resetForm()
      load()
    } catch { }
    setAdding(false)
  }

  async function handleSaveEdit() {
    if (!viewingData) return
    setSavingEdit(true)
    try {
      await supabase.from('prescriptions').update({
        notes: JSON.stringify(viewingData.visit)
      }).eq('id', viewingData.id)
      setIsEditing(false)
      load()
    } catch { }
    setSavingEdit(false)
  }

  async function handlePDFToForm() {
    if (!selectedFile) return
    setExtracting(true)
    try {
      const text = await extractTextFromPdf(selectedFile)
      const data = await parseVisitPrescription(text)

      setPatientName(data.patientName || '')
      setPatientAge(data.patientAge || '')
      setReason(data.reasonForVisit || '')
      setDoctorName(data.doctorName || '')
      setPrescriptionDate(data.prescriptionDate || new Date().toISOString().split('T')[0])

      const meds = data.medicines || []
      if (meds.length > 0) {
        setMedicines(meds.map((m: any) => ({
          drug_name: m.drug_name || '',
          dosage: m.dosage || '',
          frequency: m.frequency || '',
          duration: m.duration || '',
          notes: m.notes || ''
        })))
        setNumMedicines(meds.length.toString())
      } else {
        setNumMedicines('1')
        setMedicines([{ drug_name: '', dosage: '', frequency: '', duration: '', notes: '' }])
      }

      setShowForm(true)
      setFormStep(1)
      setSelectedFile(null)
    } catch (e) {
      console.error(e)
    }
    setExtracting(false)
  }

  type ParsedPrescriptionType = Prescription & {
    isVisit: boolean
    visitData?: VisitPrescription
  }

  const parsedPrescriptions: ParsedPrescriptionType[] = prescriptions.map(p => {
    if (p.drug_name === 'Visit Prescription' && p.notes) {
      try {
        const data: VisitPrescription = JSON.parse(p.notes)
        return { ...p, isVisit: true, visitData: data }
      } catch {
        return { ...p, isVisit: false }
      }
    }
    return { ...p, isVisit: false }
  })

  function formatDate(dateString: string) {
    const d = new Date(dateString)
    if (isNaN(d.getTime())) return dateString
    const dd = String(d.getDate()).padStart(2, '0')
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const yy = String(d.getFullYear()).slice(-2)
    return `${dd}/${mm}/${yy}`
  }

  const grouped = parsedPrescriptions.reduce<Record<string, any[]>>((acc, p) => {
    let dateStr = ''
    if (p.isVisit && p.visitData?.prescriptionDate) {
      dateStr = formatDate(p.visitData.prescriptionDate)
    } else {
      dateStr = formatDate(p.created_at)
    }
    if (!acc[dateStr]) acc[dateStr] = []
    acc[dateStr].push(p)
    return acc
  }, {})

  function updateMed(index: number, field: keyof MedicationDetails, value: string) {
    const newMeds = [...medicines]
    newMeds[index] = { ...newMeds[index], [field]: value }
    setMedicines(newMeds)
  }

  function updateEditMed(index: number, field: keyof MedicationDetails, value: string) {
    if (!viewingData) return
    const newMeds = [...viewingData.visit.medicines]
    newMeds[index] = { ...newMeds[index], [field]: value }
    setViewingData({ ...viewingData, visit: { ...viewingData.visit, medicines: newMeds } })
  }

  return (
    <div style={{ width: '430px', minHeight: '100vh', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      <ScreenHeader title="Prescriptions & Drugs" />

      <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.02)' }}>
        <div
          onClick={() => setActiveTab('history')}
          style={{
            flex: 1, textAlign: 'center', padding: '14px', cursor: 'pointer',
            fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '0.9rem', fontWeight: 600,
            color: activeTab === 'history' ? '#00C9A7' : 'rgba(255,255,255,0.5)',
            borderBottom: activeTab === 'history' ? '2px solid #00C9A7' : '2px solid transparent',
            transition: 'all 0.2s'
          }}
        >
          History
        </div>
        <div
          onClick={() => setActiveTab('lookup')}
          style={{
            flex: 1, textAlign: 'center', padding: '14px', cursor: 'pointer',
            fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '0.9rem', fontWeight: 600,
            color: activeTab === 'lookup' ? '#A78BFA' : 'rgba(255,255,255,0.5)',
            borderBottom: activeTab === 'lookup' ? '2px solid #A78BFA' : '2px solid transparent',
            transition: 'all 0.2s'
          }}
        >
          Drug Lookup
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: '16px', paddingBottom: '96px' }}>

        {activeTab === 'history' && (
          <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {!showForm && (
              <>
                <div style={{ display: 'flex', gap: '12px', margin: '16px 0 8px' }}>
                  <button
                    onClick={() => setShowForm(true)}
                    style={{
                      flex: 1, padding: '14px',
                      background: 'linear-gradient(135deg, #00C9A7, #00A88E)',
                      color: '#fff', border: 'none', borderRadius: '14px',
                      fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '0.92rem', fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                      boxShadow: '0 0 20px rgba(0,201,167,0.3)',
                    }}
                  >
                    Add Prescription
                  </button>

                  <label style={{
                    flex: 1, padding: '14px',
                    background: 'rgba(255,255,255,0.06)', backdropFilter: 'blur(20px)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    color: '#fff', borderRadius: '14px',
                    fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '0.92rem', fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  }}>
                    Upload PDF
                    <input
                      type="file"
                      accept="application/pdf"
                      style={{ display: 'none' }}
                      onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                    />
                  </label>
                </div>

                {selectedFile && (
                  <div className="fade-in" style={{
                    display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px',
                    padding: '12px 16px', background: 'rgba(255,255,255,0.08)', borderRadius: '14px',
                    border: '1px solid rgba(0,201,167,0.3)'
                  }}>
                    <span style={{ color: '#fff', fontSize: '0.85rem', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {selectedFile.name}
                    </span>
                    <button
                      onClick={handlePDFToForm}
                      disabled={extracting}
                      style={{
                        padding: '8px 16px', background: '#00C9A7', color: '#fff', border: 'none',
                        borderRadius: '10px', fontSize: '0.75rem', fontWeight: 700, cursor: extracting ? 'not-allowed' : 'pointer',
                        boxShadow: '0 0 10px rgba(0,201,167,0.2)',
                        display: 'flex', alignItems: 'center', gap: '6px'
                      }}>
                      {extracting ? (
                        <>
                          <span style={{ width: '12px', height: '12px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} />
                          Extracting...
                        </>
                      ) : 'Add to prescriptions'}
                    </button>
                    <button
                      onClick={() => setSelectedFile(null)}
                      style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: '1.2rem', padding: '0 4px', lineHeight: 1 }}
                    >×</button>
                  </div>
                )}
              </>
            )}

            {loading && (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
                <span style={{ width: '24px', height: '24px', border: '2px solid rgba(255,255,255,0.15)', borderTopColor: '#00C9A7', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} />
              </div>
            )}

            {error && (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem' }}>
                Failed to load prescriptions.
              </div>
            )}

            {!loading && !error && prescriptions.length === 0 && !showForm && (
              <div style={{ textAlign: 'center', padding: '60px 0', display: 'flex', flexDirection: 'center', alignItems: 'center', gap: '12px' }}>
                <div style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '0.9rem', fontWeight: 700, color: 'rgba(255,255,255,0.6)' }}>No prescriptions yet</div>
                <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.3)', maxWidth: '200px', lineHeight: 1.6 }}>
                  Upload prescription PDF to add prescription, or add one manually below.
                </div>
              </div>
            )}

            {!loading && Object.entries(grouped).map(([date, items]) => (
              <div key={date} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{
                  fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem',
                  textTransform: 'uppercase', letterSpacing: '0.08em',
                  color: 'rgba(255,255,255,0.3)', paddingLeft: '4px',
                }}>{date}</div>

                <div style={{
                  background: 'rgba(255,255,255,0.06)', backdropFilter: 'blur(20px)',
                  border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', overflow: 'hidden',
                }}>
                  {items.map((p, i) => (
                    <div key={p.id}
                      onClick={() => {
                        if (p.isVisit) {
                          setViewingData({ id: p.id, visit: p.visitData, created_at: p.created_at })
                          setIsEditing(false)
                        }
                      }}
                      style={{
                        padding: '14px 16px',
                        borderBottom: i < items.length - 1 ? '1px solid rgba(255,255,255,0.07)' : 'none',
                        borderLeft: p.isVisit ? '3px solid #8A2BE2' : '3px solid #00C9A7',
                        display: 'flex', alignItems: 'flex-start', gap: '10px',
                        opacity: deletingId === p.id ? 0.4 : 1,
                        transition: 'opacity 0.2s',
                        cursor: p.isVisit ? 'pointer' : 'default',
                      }}>
                      {p.isVisit ? (
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <div style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '0.88rem', fontWeight: 700, color: '#fff' }}>
                            Medical Visit Prescription
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            {p.visitData.doctorName && <span>Dr. {p.visitData.doctorName}</span>}
                            {p.visitData.reasonForVisit && <span>· {p.visitData.reasonForVisit}</span>}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)', marginTop: '4px' }}>
                            {p.visitData.medicines?.length || 0} medicine(s) prescribed
                          </div>
                        </div>
                      ) : (
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <div style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '0.88rem', fontWeight: 700, color: '#fff' }}>
                            {p.drug_name}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            {p.dosage && <span>{p.dosage}</span>}
                            {p.frequency && <span>· {p.frequency}</span>}
                            {p.duration && <span>· {p.duration}</span>}
                          </div>
                          {p.notes && (
                            <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.35)', fontStyle: 'italic' }}>
                              {p.notes}
                            </div>
                          )}
                        </div>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(p.id) }}
                        disabled={deletingId === p.id}
                        style={{
                          flexShrink: 0, width: '24px', height: '24px',
                          background: 'rgba(255,90,95,0.12)',
                          border: '1px solid rgba(255,90,95,0.25)',
                          borderRadius: '50%', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: 'rgba(255,90,95,0.8)', fontSize: '0.7rem', lineHeight: 1,
                          marginTop: '2px',
                        }}
                      >✕</button>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {showForm && (
              <>
                {formStep === 1 && (
                  <div className="fade-in" style={{
                    background: 'rgba(255,255,255,0.06)', backdropFilter: 'blur(20px)',
                    border: '1px solid rgba(255,255,255,0.12)', borderRadius: '16px', padding: '18px',
                  }}>
                    <div style={{
                      fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem',
                      textTransform: 'uppercase', letterSpacing: '0.1em',
                      color: 'rgba(255,255,255,0.35)', marginBottom: '16px',
                    }}>Step 1: Visit Details</div>

                    <div style={{ marginBottom: '12px' }}>
                      <label style={LBL}>Patient Name</label>
                      <input style={GLS} value={patientName} onChange={e => setPatientName(e.target.value)} placeholder="e.g. John Doe" />
                    </div>
                    <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
                      <div style={{ flex: 1 }}>
                        <label style={LBL}>Age</label>
                        <input style={GLS} type="number" value={patientAge} onChange={e => setPatientAge(e.target.value)} placeholder="e.g. 45" />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={LBL}>Date</label>
                        <div
                          style={{ position: 'relative', cursor: 'pointer' }}
                          onClick={() => {
                            try {
                              prescriptionDateRef.current?.showPicker()
                            } catch (e) {
                              prescriptionDateRef.current?.click()
                            }
                          }}
                        >
                          <input
                            style={GLS}
                            type="text"
                            readOnly
                            value={formatDate(prescriptionDate)}
                          />
                          <input
                            ref={prescriptionDateRef}
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
                            value={prescriptionDate}
                            onChange={e => setPrescriptionDate(e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                    <div style={{ marginBottom: '12px' }}>
                      <label style={LBL}>Reason for Visit</label>
                      <input style={GLS} value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Routine checkup" />
                    </div>
                    <div style={{ marginBottom: '12px' }}>
                      <label style={LBL}>Doctor's Name</label>
                      <input style={GLS} value={doctorName} onChange={e => setDoctorName(e.target.value)} placeholder="e.g. Dr. Smith" />
                    </div>
                    <div style={{ marginBottom: '16px' }}>
                      <label style={LBL}>Number of Medicines</label>
                      <input style={GLS} type="number" min="1" max="20" value={numMedicines} onChange={e => setNumMedicines(e.target.value)} />
                    </div>

                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => setShowForm(false)}
                        style={{
                          flex: 1, padding: '12px',
                          background: 'rgba(255,255,255,0.06)',
                          color: 'rgba(255,255,255,0.6)',
                          border: '1px solid rgba(255,255,255,0.12)',
                          borderRadius: '10px', cursor: 'pointer',
                          fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '0.82rem', fontWeight: 600,
                        }}
                      >Cancel</button>
                      <button
                        onClick={handleNextStep}
                        disabled={!parseInt(numMedicines, 10)}
                        style={{
                          flex: 2, padding: '12px',
                          background: !parseInt(numMedicines, 10) ? 'rgba(255,255,255,0.08)' : 'linear-gradient(135deg,#00C9A7,#00A88E)',
                          color: '#fff', border: 'none', borderRadius: '10px',
                          fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '0.85rem', fontWeight: 700,
                          cursor: !parseInt(numMedicines, 10) ? 'not-allowed' : 'pointer',
                          boxShadow: !parseInt(numMedicines, 10) ? 'none' : '0 0 16px rgba(0,201,167,0.35)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                          opacity: !parseInt(numMedicines, 10) ? 0.5 : 1,
                        }}
                      >Next →</button>
                    </div>
                  </div>
                )}

                {formStep === 2 && (
                  <div className="fade-in" style={{
                    background: 'rgba(255,255,255,0.06)', backdropFilter: 'blur(20px)',
                    border: '1px solid rgba(255,255,255,0.12)', borderRadius: '16px', padding: '18px',
                  }}>
                    <div style={{
                      fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem',
                      textTransform: 'uppercase', letterSpacing: '0.1em',
                      color: 'rgba(255,255,255,0.35)', marginBottom: '16px',
                    }}>Step 2: Medications</div>

                    <div style={{ maxHeight: '400px', overflowY: 'auto', paddingRight: '4px', display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '16px' }}>
                      {medicines.map((med, idx) => (
                        <div key={idx} style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)' }}>
                          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#00C9A7', marginBottom: '12px' }}>Medicine {idx + 1}</div>
                          <div style={{ marginBottom: '12px' }}>
                            <label style={LBL}>Medicine Name *</label>
                            <input style={GLS} value={med.drug_name} onChange={e => updateMed(idx, 'drug_name', e.target.value)} />
                          </div>
                          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                            <div style={{ flex: 1 }}>
                              <label style={LBL}>Dosage</label>
                              <input style={GLS} value={med.dosage} onChange={e => updateMed(idx, 'dosage', e.target.value)} placeholder="(e.g. 500mg)" />
                            </div>
                            <div style={{ flex: 1 }}>
                              <label style={LBL}>Frequency</label>
                              <input style={GLS} value={med.frequency} onChange={e => updateMed(idx, 'frequency', e.target.value)} placeholder="(e.g. Twice daily)" />
                            </div>
                          </div>
                          <div style={{ marginBottom: '12px' }}>
                            <label style={LBL}>Duration</label>
                            <input style={GLS} value={med.duration} onChange={e => updateMed(idx, 'duration', e.target.value)} placeholder="(e.g. 30 days)" />
                          </div>
                          <div>
                            <label style={LBL}>Notes</label>
                            <input style={GLS} value={med.notes} onChange={e => updateMed(idx, 'notes', e.target.value)} placeholder="Additional instructions..." />
                          </div>
                        </div>
                      ))}
                    </div>

                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => setFormStep(1)}
                        style={{
                          flex: 1, padding: '12px',
                          background: 'rgba(255,255,255,0.06)',
                          color: 'rgba(255,255,255,0.6)',
                          border: '1px solid rgba(255,255,255,0.12)',
                          borderRadius: '10px', cursor: 'pointer',
                          fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '0.82rem', fontWeight: 600,
                        }}
                      >Back</button>
                      <button
                        onClick={handleAddVisit}
                        disabled={adding || !medicines.some(m => m.drug_name.trim())}
                        style={{
                          flex: 2, padding: '12px',
                          background: !medicines.some(m => m.drug_name.trim()) ? 'rgba(255,255,255,0.08)' : 'linear-gradient(135deg,#00C9A7,#00A88E)',
                          color: '#fff', border: 'none', borderRadius: '10px',
                          fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '0.85rem', fontWeight: 700,
                          cursor: adding || !medicines.some(m => m.drug_name.trim()) ? 'not-allowed' : 'pointer',
                          boxShadow: !medicines.some(m => m.drug_name.trim()) ? 'none' : '0 0 16px rgba(0,201,167,0.35)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                          opacity: !medicines.some(m => m.drug_name.trim()) ? 0.5 : 1,
                        }}
                      >
                        {adding ? <span style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} /> : '+ Save'}
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {activeTab === 'lookup' && (
          <div className="fade-in">
            <div style={{ display: 'flex', gap: '8px', marginBottom: '18px' }}>
              <input
                value={drugInput}
                onChange={e => setDrugInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addDrugToLookup()}
                placeholder="Lookup drug info (e.g. Ramipril)…"
                style={{
                  flex: 1, padding: '12px 14px',
                  border: '1px solid rgba(255,255,255,0.12)', borderRadius: '10px',
                  fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '0.82rem',
                  outline: 'none', background: 'rgba(255,255,255,0.07)',
                  color: 'rgba(255,255,255,0.9)',
                }}
              />
              <button
                onClick={addDrugToLookup}
                style={{
                  padding: '12px 16px',
                  background: 'linear-gradient(135deg,#00C9A7,#00A88E)',
                  color: '#fff', border: 'none', borderRadius: '10px',
                  fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer',
                  boxShadow: '0 0 14px rgba(0,201,167,0.35)',
                  fontFamily: 'Plus Jakarta Sans, sans-serif',
                }}
              >+ Lookup</button>
            </div>

            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.61rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.35)', marginBottom: '12px' }}>
              Saved Drugs
            </div>

            {allDrugs.length === 0 && (
              <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.35)', padding: '8px 0 16px' }}>
                No drugs saved yet — type one above to look it up.
              </div>
            )}

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '22px' }}>
              {allDrugs.map(d => (
                <div
                  key={d}
                  onClick={() => lookup(d)}
                  style={{
                    padding: '8px 16px', borderRadius: '20px',
                    fontSize: '0.75rem', fontFamily: 'JetBrains Mono, monospace',
                    cursor: 'pointer', fontWeight: 500,
                    border: `1px solid ${selectedDrug === d ? '#A78BFA' : 'rgba(255,255,255,0.14)'}`,
                    background: selectedDrug === d ? 'rgba(167,139,250,0.18)' : 'rgba(255,255,255,0.06)',
                    color: selectedDrug === d ? '#A78BFA' : 'rgba(255,255,255,0.65)',
                    boxShadow: selectedDrug === d ? '0 0 12px rgba(167,139,250,0.3)' : 'none',
                    transition: 'all 0.2s',
                  }}
                >{d}</div>
              ))}
            </div>

            {(drugLoading || drugDetail) && (
              <div style={{
                background: 'rgba(255,255,255,0.07)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: '16px', padding: '20px',
              }}>
                {drugLoading ? (
                  <div style={{ display: 'flex', justifyContent: 'center', padding: '20px' }}>
                    <div style={{ width: '22px', height: '22px', border: '2px solid rgba(255,255,255,0.15)', borderTopColor: '#A78BFA', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                  </div>
                ) : drugDetail && (
                  <>
                    <div style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '1.2rem', fontWeight: 800, marginBottom: '2px', color: 'rgba(255,255,255,0.95)' }}>
                      {selectedDrug?.split(' ')[0]}
                    </div>
                    <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.62rem', color: 'rgba(255,255,255,0.38)', marginBottom: '18px' }}>
                      {drugDetail.generic_name}
                    </div>
                    {INFO_ROWS.map(({ label, val, accent }) => (
                      <div key={label} style={{ display: 'flex', gap: '10px', marginBottom: '14px', paddingLeft: '10px', borderLeft: `2px solid ${accent}` }}>
                        <div>
                          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.58rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'rgba(255,255,255,0.35)', marginBottom: '4px' }}>
                            {label}
                          </div>
                          <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.82)', lineHeight: 1.55 }}>{val}</div>
                        </div>
                      </div>
                    ))}
                    {drugDetail.source === 'OpenFDA' && (
                      <div style={{
                        marginTop: '20px', paddingTop: '12px',
                        borderTop: '1px solid rgba(255,255,255,0.06)',
                        fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem',
                        color: 'rgba(255,255,255,0.25)', textAlign: 'center',
                        letterSpacing: '0.05em'
                      }}>
                        Sourced from OpenFDA
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {viewingData && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          background: '#0F172A', zIndex: 100, display: 'flex', flexDirection: 'column',
        }}>
          <div style={{ padding: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
            <button onClick={() => setViewingData(null)} style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '1.2rem', cursor: 'pointer' }}>←</button>
            <div style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 600, color: '#fff', fontSize: '1rem' }}>
              {isEditing ? 'Edit Prescription' : 'Prescription Details'}
            </div>
            {isEditing ? (
              <button
                onClick={handleSaveEdit}
                disabled={savingEdit}
                style={{ background: 'transparent', border: 'none', color: '#00C9A7', fontWeight: 600, cursor: savingEdit ? 'not-allowed' : 'pointer', fontSize: '0.9rem' }}
              >
                {savingEdit ? 'Saving...' : 'Save'}
              </button>
            ) : (
              <button onClick={() => setIsEditing(true)} style={{ background: 'transparent', border: 'none', color: '#fff', fontWeight: 600, cursor: 'pointer', opacity: 0.7, fontSize: '0.9rem' }}>Edit</button>
            )}
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '20px', paddingBottom: '100px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '16px', padding: '16px', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.65rem', color: '#00C9A7', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '12px' }}>Visit Info</div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label style={LBL}>Patient Name</label>
                  {isEditing ? (
                    <input style={GLS} value={viewingData.visit.patientName} onChange={e => setViewingData({ ...viewingData, visit: { ...viewingData.visit, patientName: e.target.value } })} />
                  ) : <div style={{ color: '#fff', fontSize: '0.9rem' }}>{viewingData.visit.patientName || '-'}</div>}
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                  <div style={{ flex: 1 }}>
                    <label style={LBL}>Age</label>
                    {isEditing ? (
                      <input style={GLS} type="number" value={viewingData.visit.patientAge} onChange={e => setViewingData({ ...viewingData, visit: { ...viewingData.visit, patientAge: e.target.value } })} />
                    ) : <div style={{ color: '#fff', fontSize: '0.9rem' }}>{viewingData.visit.patientAge || '-'}</div>}
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={LBL}>Date</label>
                    {isEditing ? (
                      <div
                        style={{ position: 'relative', cursor: 'pointer' }}
                        onClick={() => {
                          try {
                            editDateRef.current?.showPicker()
                          } catch (e) {
                            editDateRef.current?.click()
                          }
                        }}
                      >
                        <input
                          style={GLS}
                          type="text"
                          readOnly
                          value={formatDate(viewingData.visit.prescriptionDate || '')}
                        />
                        <input
                          ref={editDateRef}
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
                          value={viewingData.visit.prescriptionDate || ''}
                          onChange={e => setViewingData({ ...viewingData, visit: { ...viewingData.visit, prescriptionDate: e.target.value } })}
                        />
                      </div>
                    ) : <div style={{ color: '#fff', fontSize: '0.9rem' }}>{viewingData.visit.prescriptionDate ? formatDate(viewingData.visit.prescriptionDate) : '-'}</div>}
                  </div>
                </div>

                <div>
                  <label style={LBL}>Doctor Name</label>
                  {isEditing ? (
                    <input style={GLS} value={viewingData.visit.doctorName} onChange={e => setViewingData({ ...viewingData, visit: { ...viewingData.visit, doctorName: e.target.value } })} />
                  ) : <div style={{ color: '#fff', fontSize: '0.9rem' }}>{viewingData.visit.doctorName || '-'}</div>}
                </div>

                <div>
                  <label style={LBL}>Reason for Visit</label>
                  {isEditing ? (
                    <input style={GLS} value={viewingData.visit.reasonForVisit} onChange={e => setViewingData({ ...viewingData, visit: { ...viewingData.visit, reasonForVisit: e.target.value } })} />
                  ) : <div style={{ color: '#fff', fontSize: '0.9rem' }}>{viewingData.visit.reasonForVisit || '-'}</div>}
                </div>
              </div>
            </div>

            <div>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.65rem', color: '#00C9A7', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '12px', marginLeft: '4px' }}>Prescribed Medicines</div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {viewingData.visit.medicines.map((med, idx) => (
                  <div key={idx} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '16px', padding: '16px', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <div style={{ fontWeight: 600, color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem', marginBottom: '12px' }}>Medicine {idx + 1}</div>

                    {isEditing ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div><label style={LBL}>Name *</label><input style={GLS} value={med.drug_name} onChange={e => updateEditMed(idx, 'drug_name', e.target.value)} /></div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <div style={{ flex: 1 }}><label style={LBL}>Dosage</label><input style={GLS} value={med.dosage} onChange={e => updateEditMed(idx, 'dosage', e.target.value)} /></div>
                          <div style={{ flex: 1 }}><label style={LBL}>Frequency</label><input style={GLS} value={med.frequency} onChange={e => updateEditMed(idx, 'frequency', e.target.value)} /></div>
                        </div>
                        <div><label style={LBL}>Duration</label><input style={GLS} value={med.duration} onChange={e => updateEditMed(idx, 'duration', e.target.value)} /></div>
                        <div><label style={LBL}>Notes</label><input style={GLS} value={med.notes} onChange={e => updateEditMed(idx, 'notes', e.target.value)} /></div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ color: '#00C9A7', fontWeight: 600, fontSize: '0.95rem' }}>{med.drug_name || 'Unnamed Medicine'}</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem' }}>
                          {med.dosage && <div><span style={{ color: 'rgba(255,255,255,0.3)' }}>Dose:</span> {med.dosage}</div>}
                          {med.frequency && <div><span style={{ color: 'rgba(255,255,255,0.3)' }}>Freq:</span> {med.frequency}</div>}
                          {med.duration && <div><span style={{ color: 'rgba(255,255,255,0.3)' }}>Dur:</span> {med.duration}</div>}
                        </div>
                        {med.notes && <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem', fontStyle: 'italic', marginTop: '4px' }}>{med.notes}</div>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      )}

      <BottomNav />

      {showDeleteModal && (
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
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff', marginBottom: '8px' }}>Delete Prescription?</div>
            <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)', marginBottom: '24px', lineHeight: 1.5 }}>
              This record will be permanently removed from your medical history. This action cannot be undone.
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
