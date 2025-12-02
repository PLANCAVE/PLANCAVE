import { useState, useEffect } from 'react';
import { X, Mail, Phone, MapPin, Send } from 'lucide-react';

interface ContactModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ContactModal({ isOpen, onClose }: ContactModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    message: ''
  });
  const [loading, setLoading] = useState(false);

  // Close modal on Escape key press
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    // TODO: Backend integration later
    setTimeout(() => {
      alert('Thank you for contacting us! We will get back to you within 24 hours.');
      setFormData({ name: '', email: '', phone: '', message: '' });
      setLoading(false);
      onClose();
    }, 1000);
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-3xl shadow-2xl max-w-3xl w-full my-8 relative animate-in zoom-in-95 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button - more prominent */}
        <button
          onClick={onClose}
          className="absolute -top-4 -right-4 z-20 bg-gradient-to-br from-red-500 to-red-600 text-white p-3 rounded-full shadow-xl hover:scale-110 hover:shadow-2xl transition-all duration-200"
          aria-label="Close modal"
        >
          <X className="w-6 h-6" />
        </button>

        {/* Header with gradient */}
        <div className="bg-gradient-to-br from-teal-600 via-cyan-600 to-blue-600 text-white p-8 rounded-t-3xl relative overflow-hidden">
          {/* Decorative circles */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32"></div>
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/10 rounded-full -ml-24 -mb-24"></div>
          
          <div className="relative z-10">
            <h2 className="text-4xl font-bold mb-3">Get In Touch</h2>
            <p className="text-teal-50 text-lg">We're here to help bring your construction plans to life</p>
          </div>
        </div>

        {/* Content */}
        <div className="p-8">
          {/* Contact Information Cards - Modern Design */}
          <div className="grid md:grid-cols-3 gap-6 mb-10">
            <div className="group flex flex-col items-center text-center p-6 bg-gradient-to-br from-teal-50 to-teal-100 rounded-2xl hover:shadow-lg transition-all duration-300 border border-teal-200">
              <div className="p-4 bg-gradient-to-br from-teal-600 to-teal-700 rounded-2xl mb-4 group-hover:scale-110 transition-transform">
                <Mail className="w-7 h-7 text-white" />
              </div>
              <p className="font-bold text-gray-900 mb-2 text-lg">Email Us</p>
              <a href="mailto:admin@plancave.com" className="text-sm text-teal-700 hover:text-teal-900 font-medium hover:underline">
                admin@plancave.com
              </a>
            </div>

            <div className="group flex flex-col items-center text-center p-6 bg-gradient-to-br from-cyan-50 to-cyan-100 rounded-2xl hover:shadow-lg transition-all duration-300 border border-cyan-200">
              <div className="p-4 bg-gradient-to-br from-cyan-600 to-cyan-700 rounded-2xl mb-4 group-hover:scale-110 transition-transform">
                <Phone className="w-7 h-7 text-white" />
              </div>
              <p className="font-bold text-gray-900 mb-2 text-lg">Call Us</p>
              <a href="tel:+254741076621" className="text-sm text-cyan-700 hover:text-cyan-900 font-medium hover:underline">
                +254 741 076 621
              </a>
            </div>

            <div className="group flex flex-col items-center text-center p-6 bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl hover:shadow-lg transition-all duration-300 border border-blue-200">
              <div className="p-4 bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl mb-4 group-hover:scale-110 transition-transform">
                <MapPin className="w-7 h-7 text-white" />
              </div>
              <p className="font-bold text-gray-900 mb-2 text-lg">Visit Us</p>
              <p className="text-sm text-blue-700 font-medium leading-relaxed">
                Karen Watermark<br />Business Center
              </p>
            </div>
          </div>

          {/* Contact Form - Modern Design */}
          <form onSubmit={handleSubmit} className="space-y-6 bg-gradient-to-br from-gray-50 to-white p-8 rounded-2xl border border-gray-200">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-1 h-8 bg-gradient-to-b from-teal-600 to-cyan-600 rounded-full"></div>
              <h3 className="text-2xl font-bold text-gray-900">Send Us a Message</h3>
            </div>
            
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Your Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-xl focus:border-teal-500 focus:ring-4 focus:ring-teal-100 outline-none transition-all"
                  placeholder="John Doe"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Email Address *
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-xl focus:border-teal-500 focus:ring-4 focus:ring-teal-100 outline-none transition-all"
                  placeholder="you@example.com"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Phone Number
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({...formData, phone: e.target.value})}
                className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-xl focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100 outline-none transition-all"
                placeholder="+254 712 345 678"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Message *
              </label>
              <textarea
                value={formData.message}
                onChange={(e) => setFormData({...formData, message: e.target.value})}
                className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-xl focus:border-teal-500 focus:ring-4 focus:ring-teal-100 outline-none transition-all resize-none"
                rows={5}
                placeholder="Tell us about your project or inquiry..."
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-teal-600 via-cyan-600 to-blue-600 text-white py-4 px-8 rounded-xl hover:shadow-2xl hover:shadow-teal-500/50 hover:scale-[1.02] transition-all duration-300 font-bold text-lg flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              {loading ? (
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Sending...</span>
                </div>
              ) : (
                <>
                  <Send className="w-6 h-6" />
                  Send Message
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
