import { useState } from 'react';
import { Plus, Search, Edit2, Trash2, Download, Menu } from 'lucide-react';
import AdminSidebar from '../components/AdminSidebar';

const MOCK_PAPERS = [
  { id: 1, title: '2023 End of Semester', subject: 'Macroeconomics', code: 'ECON201', year: '2023', semester: 'Second' },
  { id: 2, title: '2022 Mid Semester', subject: 'Business Law', code: 'LAW101', year: '2022', semester: 'First' },
  { id: 3, title: '2023 End of Semester', subject: 'Calculus I', code: 'MATH101', year: '2023', semester: 'First' },
];

const AdminPapersPage = () => {
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
          <h1 className="text-lg font-bold text-theme-primary">Papers</h1>
        </header>
      <main className="flex-1 p-4 md:p-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-theme-primary mb-2">Manage Papers</h1>
            <p className="text-theme-muted">Upload, edit, or remove past questions.</p>
          </div>
          <button 
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl transition-colors font-medium"
          >
            <Plus className="w-4 h-4" />
            Upload Paper
          </button>
        </div>

        <div className="glass-card p-6 border-theme-border">
          <div className="flex justify-between items-center mb-6">
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-theme-muted" />
              <input 
                type="text" 
                placeholder="Search papers..." 
                className="w-full bg-theme-surface border border-theme-border rounded-xl py-2 pl-9 pr-4 text-sm text-theme-primary focus:outline-none focus:border-indigo-500/50"
              />
            </div>
            
            <div className="flex gap-2 text-sm">
              <select className="bg-theme-surface border border-theme-border text-theme-primary rounded-lg px-3 py-2 outline-none">
                <option value="">All Subjects</option>
                <option value="ECON201">ECON201</option>
                <option value="LAW101">LAW101</option>
              </select>
              <select className="bg-theme-surface border border-theme-border text-theme-primary rounded-lg px-3 py-2 outline-none">
                <option value="">All Years</option>
                <option value="2023">2023</option>
                <option value="2022">2022</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-theme-border text-sm text-theme-muted">
                  <th className="pb-3 font-medium">Title</th>
                  <th className="pb-3 font-medium">Subject</th>
                  <th className="pb-3 font-medium">Year / Sem</th>
                  <th className="pb-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {MOCK_PAPERS.map((paper) => (
                  <tr key={paper.id} className="border-b border-theme-border last:border-0 hover:bg-theme-surface transition-colors">
                    <td className="py-4 text-sm text-theme-primary font-medium">{paper.title}</td>
                    <td className="py-4 text-sm text-theme-secondary">
                      {paper.subject} <span className="text-indigo-400 font-mono text-xs ml-1 bg-indigo-500/10 px-1 rounded">{paper.code}</span>
                    </td>
                    <td className="py-4 text-sm text-theme-muted">{paper.year} • {paper.semester}</td>
                    <td className="py-4 text-sm text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button className="p-2 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 transition-colors">
                          <Download className="w-4 h-4" />
                        </button>
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

      {/* Upload Paper Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-card w-full max-w-lg p-6 border-theme-border">
            <h2 className="text-xl font-bold text-theme-primary mb-4">Upload Past Paper</h2>
            <form className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5 col-span-2">
                  <label className="text-sm text-theme-secondary">Title</label>
                  <input type="text" className="bg-theme-surface border border-theme-border rounded-xl px-4 py-2 text-theme-primary" placeholder="e.g. 2023 End of Semester" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm text-theme-secondary">Subject</label>
                  <select className="bg-theme-surface border border-theme-border rounded-xl px-4 py-2 text-theme-primary outline-none">
                    <option value="">Select Subject</option>
                    <option value="1">Macroeconomics</option>
                    <option value="2">Business Law</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm text-theme-secondary">Year</label>
                  <input type="text" className="bg-theme-surface border border-theme-border rounded-xl px-4 py-2 text-theme-primary" placeholder="2023" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm text-theme-secondary">Semester</label>
                  <select className="bg-theme-surface border border-theme-border rounded-xl px-4 py-2 text-theme-primary outline-none">
                    <option value="First">First</option>
                    <option value="Second">Second</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1.5 col-span-2">
                  <label className="text-sm text-theme-secondary">PDF File Upload</label>
                  <input type="file" accept="application/pdf" className="w-full bg-theme-surface border border-theme-border rounded-xl px-4 py-1.5 text-white text-sm file:mr-4 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-500 file:text-white hover:file:bg-indigo-600" />
                </div>
                <div className="flex flex-col gap-1.5 col-span-2">
                  <label className="text-sm text-theme-secondary">Or External Download URL</label>
                  <input type="url" placeholder="https://example.com/paper.pdf" className="w-full bg-theme-surface border border-theme-border rounded-xl px-4 py-2 text-theme-primary outline-none focus:border-indigo-500/50" />
                </div>
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
                  Upload Paper
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPapersPage;
