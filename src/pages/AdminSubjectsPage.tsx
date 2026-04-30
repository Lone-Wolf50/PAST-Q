import { useState } from 'react';
import { Plus, Search, Edit2, Trash2, Menu } from 'lucide-react';
import AdminSidebar from '../components/AdminSidebar';

const MOCK_SUBJECTS = [
  { id: 1, name: 'Macroeconomics', code: 'ECON201', count: 12 },
  { id: 2, name: 'Business Law', code: 'LAW101', count: 8 },
  { id: 3, name: 'Calculus I', code: 'MATH101', count: 15 },
  { id: 4, name: 'Introduction to Accounting', code: 'ACCT101', count: 20 },
];

const AdminSubjectsPage = () => {
  const [showModal, setShowModal] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-transparent flex font-sans">
      <AdminSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      <div className="flex-1 flex flex-col lg:ml-64">
        <header className="sticky top-0 z-20 bg-transparent/80 backdrop-blur-xl border-b border-theme-border px-4 md:px-8 py-4 flex items-center gap-4 lg:hidden">
          <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-xl bg-theme-surface text-theme-secondary">
            <Menu className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-bold text-theme-primary">Subjects</h1>
        </header>
      <main className="flex-1 p-4 md:p-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-theme-primary mb-2">Manage Subjects</h1>
            <p className="text-theme-muted">Add, edit, or remove subjects for the platform.</p>
          </div>
          <button 
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl transition-colors font-medium"
          >
            <Plus className="w-4 h-4" />
            Add Subject
          </button>
        </div>

        <div className="glass-card p-6 border-theme-border">
          <div className="flex justify-between items-center mb-6">
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-theme-muted" />
              <input 
                type="text" 
                placeholder="Search subjects..." 
                className="w-full bg-theme-surface border border-theme-border rounded-xl py-2 pl-9 pr-4 text-sm text-theme-primary focus:outline-none focus:border-indigo-500/50"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-theme-border text-sm text-theme-muted">
                  <th className="pb-3 font-medium">Subject Name</th>
                  <th className="pb-3 font-medium">Course Code</th>
                  <th className="pb-3 font-medium">Total Papers</th>
                  <th className="pb-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {MOCK_SUBJECTS.map((subject) => (
                  <tr key={subject.id} className="border-b border-theme-border last:border-0 hover:bg-theme-surface transition-colors">
                    <td className="py-4 text-sm text-theme-primary font-medium">{subject.name}</td>
                    <td className="py-4 text-sm text-indigo-400 font-mono bg-indigo-500/10 px-2 py-1 rounded w-fit inline-block mt-3">{subject.code}</td>
                    <td className="py-4 text-sm text-theme-muted">{subject.count} papers</td>
                    <td className="py-4 text-sm text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button className="p-2 rounded-lg bg-theme-surface hover:bg-theme-surface-2 text-theme-muted transition-colors">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
      </div>

      {/* Add Subject Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-card w-full max-w-md p-6 border-theme-border">
            <h2 className="text-xl font-bold text-theme-primary mb-4">Add New Subject</h2>
            <form className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm text-theme-secondary">Subject Name</label>
                <input type="text" className="bg-theme-surface border border-theme-border rounded-xl px-4 py-2 text-theme-primary" placeholder="e.g. Macroeconomics" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm text-theme-secondary">Course Code</label>
                <input type="text" className="bg-theme-surface border border-theme-border rounded-xl px-4 py-2 text-theme-primary" placeholder="e.g. ECON201" />
              </div>
              <div className="flex justify-end gap-3 mt-4">
                <button 
                  type="button" 
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl text-theme-primary bg-theme-surface-2 hover:bg-theme-surface-2"
                >
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 rounded-xl text-white bg-indigo-500 hover:bg-indigo-600">
                  Save Subject
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminSubjectsPage;
