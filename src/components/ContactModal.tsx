import { useState } from 'react';
import { X, Send, CheckCircle2, AlertCircle } from 'lucide-react';
import { apiFetch } from '../lib/api';

interface ContactModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialSubject?: string;
}

const ContactModal = ({ isOpen, onClose, initialSubject = 'General Support' }: ContactModalProps) => {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: initialSubject,
    message: ''
  });

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await apiFetch('/support/contact', {
        method: 'POST',
        body: formData
      });
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setFormData({ name: '', email: '', subject: initialSubject, message: '' });
        onClose();
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to send message. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={onClose} />
      
      <div className="relative w-full max-w-lg glass-card border-theme-border p-8 overflow-hidden">
        <button onClick={onClose} className="absolute top-4 right-4 p-2 text-theme-muted hover:text-theme-primary transition-colors">
          <X className="w-6 h-6" />
        </button>

        {success ? (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <CheckCircle2 className="w-10 h-10 text-emerald-400" />
            </div>
            <h3 className="text-xl font-bold text-theme-primary">Message Sent!</h3>
            <p className="text-theme-muted text-center">We've received your request and will get back to you soon.</p>
          </div>
        ) : (
          <>
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-theme-primary mb-2">Contact Support</h2>
              <p className="text-sm text-theme-muted">Have a problem or suggestion? Send us a message.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-theme-muted uppercase ml-1">Name</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-theme-surface border border-theme-border rounded-xl px-4 py-2.5 text-sm text-theme-primary outline-none focus:border-indigo-500/50"
                    placeholder="Your name"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-theme-muted uppercase ml-1">Email</label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full bg-theme-surface border border-theme-border rounded-xl px-4 py-2.5 text-sm text-theme-primary outline-none focus:border-indigo-500/50"
                    placeholder="Your email"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-theme-muted uppercase ml-1">Subject</label>
                <select
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  className="w-full bg-theme-surface border border-theme-border rounded-xl px-4 py-2.5 text-sm text-theme-primary outline-none focus:border-indigo-500/50"
                >
                  <option value="General Support" className="bg-theme-surface text-theme-primary">General Support</option>
                  <option value="Technical Issue" className="bg-theme-surface text-theme-primary">Technical Issue</option>
                  <option value="Billing / Pricing" className="bg-theme-surface text-theme-primary">Billing / Pricing</option>
                  <option value="Paper Content Issue" className="bg-theme-surface text-theme-primary">Paper Content Issue</option>
                  <option value="Feature Request" className="bg-theme-surface text-theme-primary">Feature Request</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-theme-muted uppercase ml-1">Message</label>
                <textarea
                  required
                  rows={4}
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  className="w-full bg-theme-surface border border-theme-border rounded-xl px-4 py-3 text-sm text-theme-primary outline-none focus:border-indigo-500/50 resize-none"
                  placeholder="How can we help you?"
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 text-red-400 text-xs">
                  <AlertCircle className="w-4 h-4" />
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white font-bold transition-all disabled:opacity-50"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Send Message
                  </>
                )}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
};

export default ContactModal;
