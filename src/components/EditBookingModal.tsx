import React, { useState } from 'react'
import { Booking } from '../types/booking'
import { X, Save, AlertCircle } from 'lucide-react'

interface EditBookingModalProps {
  booking: Booking
  onClose: () => void
  onSave: (updatedBooking: Booking) => Promise<void>
}

export function EditBookingModal({ booking, onClose, onSave }: EditBookingModalProps) {
  const [formData, setFormData] = useState({
    guest_name: booking.guest_name,
    guest_phone: booking.guest_phone,
    guest_email: booking.guest_email,
    check_in: booking.check_in,
    check_out: booking.check_out,
    status: booking.status,
    source: booking.source,
    invoice_number: booking.invoice_number || '',
    downpayment_paid: booking.downpayment_paid,
    balance_due: booking.balance_due,
    security_deposit: booking.security_deposit,
  })

  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target
    if (type === 'number') {
      setFormData(prev => ({ ...prev, [name]: parseFloat(value) || 0 }))
    } else {
      setFormData(prev => ({ ...prev, [name]: value }))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsSaving(true)
    
    if (formData.check_in >= formData.check_out) {
      setError('Check-out date must be after check-in date.')
      setIsSaving(false)
      return
    }

    try {
      const updatedBooking: Booking = {
        ...booking,
        guest_name: formData.guest_name,
        guest_phone: formData.guest_phone,
        guest_email: formData.guest_email,
        check_in: formData.check_in,
        check_out: formData.check_out,
        status: formData.status as Booking['status'],
        source: formData.source as Booking['source'],
        invoice_number: formData.invoice_number || undefined,
        downpayment_paid: formData.downpayment_paid,
        balance_due: formData.balance_due,
        security_deposit: formData.security_deposit,
      }
      
      await onSave(updatedBooking)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update booking')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="w-full max-w-2xl bg-card rounded-lg shadow-lg overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-soft">
          <h3 className="text-lg font-bold text-main">Edit Booking</h3>
          <button onClick={onClose} className="text-muted hover:text-main cursor-pointer p-1 rounded hover:bg-soft transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-100 text-rose-700 text-sm flex items-center gap-2 rounded-lg">
              <AlertCircle className="w-4 h-4" /><span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Guest Details */}
            <div className="space-y-4">
              <h4 className="text-sm font-bold text-main uppercase tracking-wider">Guest Details</h4>
              
              <div>
                <label className="text-xs text-muted font-medium block mb-1">Guest Name</label>
                <input type="text" name="guest_name" required value={formData.guest_name} onChange={handleChange}
                   className="w-full bg-white dark:bg-card border border-soft text-main px-3 py-2 rounded-lg text-sm focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary outline-none" />
              </div>
              
              <div>
                <label className="text-xs text-muted font-medium block mb-1">Phone Number</label>
                <input type="text" name="guest_phone" value={formData.guest_phone} onChange={handleChange}
                   className="w-full bg-white dark:bg-card border border-soft text-main px-3 py-2 rounded-lg text-sm focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary outline-none" />
              </div>
              
              <div>
                <label className="text-xs text-muted font-medium block mb-1">Email Address</label>
                <input type="email" name="guest_email" value={formData.guest_email} onChange={handleChange}
                   className="w-full bg-white dark:bg-card border border-soft text-main px-3 py-2 rounded-lg text-sm focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary outline-none" />
              </div>
            </div>

            {/* Booking Details */}
            <div className="space-y-4">
              <h4 className="text-sm font-bold text-main uppercase tracking-wider">Booking Details</h4>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted font-medium block mb-1">Status</label>
                  <select name="status" value={formData.status} onChange={handleChange}
                    className="w-full bg-white dark:bg-card border border-soft text-main px-3 py-2 rounded-lg text-sm focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary outline-none">
                    <option value="pending">Pending</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="blocked">Blocked</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted font-medium block mb-1">Source</label>
                  <select name="source" value={formData.source} onChange={handleChange}
                    className="w-full bg-white dark:bg-card border border-soft text-main px-3 py-2 rounded-lg text-sm focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary outline-none">
                    <option value="website">Website</option>
                    <option value="airbnb">Airbnb</option>
                    <option value="booking_com">Booking.com</option>
                    <option value="facebook">Facebook</option>
                    <option value="manual">Manual / Walk-in</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted font-medium block mb-1">Check-in</label>
                  <input type="date" name="check_in" required value={formData.check_in} onChange={handleChange}
                     className="w-full bg-white dark:bg-card border border-soft text-main px-3 py-2 rounded-lg text-sm font-mono focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary outline-none" />
                </div>
                <div>
                  <label className="text-xs text-muted font-medium block mb-1">Check-out</label>
                  <input type="date" name="check_out" required value={formData.check_out} onChange={handleChange}
                     className="w-full bg-white dark:bg-card border border-soft text-main px-3 py-2 rounded-lg text-sm font-mono focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary outline-none" />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label className="text-xs text-muted font-medium block mb-1">Invoice Number</label>
                  <input type="text" name="invoice_number" value={formData.invoice_number} onChange={handleChange}
                     className="w-full bg-white dark:bg-card border border-soft text-main px-3 py-2 rounded-lg text-sm font-mono focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary outline-none" />
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-soft pt-6">
            <h4 className="text-sm font-bold text-main uppercase tracking-wider mb-4">Financials (₱)</h4>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-xs text-muted font-medium block mb-1">Downpayment Paid</label>
                <input type="number" name="downpayment_paid" required min="0" step="0.01" value={formData.downpayment_paid} onChange={handleChange}
                   className="w-full bg-white dark:bg-card border border-soft text-main px-3 py-2 rounded-lg text-sm font-mono focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary outline-none" />
              </div>
              <div>
                <label className="text-xs text-muted font-medium block mb-1">Balance Due</label>
                <input type="number" name="balance_due" required min="0" step="0.01" value={formData.balance_due} onChange={handleChange}
                   className="w-full bg-white dark:bg-card border border-soft text-main px-3 py-2 rounded-lg text-sm font-mono focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary outline-none" />
              </div>
              <div>
                <label className="text-xs text-muted font-medium block mb-1">Security Deposit</label>
                <input type="number" name="security_deposit" required min="0" step="0.01" value={formData.security_deposit} onChange={handleChange}
                   className="w-full bg-white dark:bg-card border border-soft text-main px-3 py-2 rounded-lg text-sm font-mono focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary outline-none" />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-6 border-t border-soft">
            <button type="button" onClick={onClose} disabled={isSaving}
              className="px-4 py-2 text-sm font-semibold text-muted hover:text-main bg-page hover:bg-soft rounded-lg transition-colors cursor-pointer">
              Cancel
            </button>
            <button type="submit" disabled={isSaving}
              className="px-5 py-2 text-sm font-bold text-white bg-brand-primary hover:bg-brand-primary/90 disabled:opacity-50 rounded-lg flex items-center gap-2 transition-colors cursor-pointer shadow-sm">
              <Save className="w-4 h-4" />
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
