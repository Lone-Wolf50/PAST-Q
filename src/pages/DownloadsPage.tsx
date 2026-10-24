import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Download, Eye, Trash2, FolderDown, Crown, Clock, BookOpen, Search, Loader2, ArrowUpRight, FileText } from 'lucide-react';
import { clsx } from 'clsx';
import { apiFetch, apiDownload } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { AlertModal } from '../components/ui/AlertModal';

interface DownloadItem {
  id: string;
  paper_id: string;
  paper_title: string;
  subject_name: string | null;
  subject_code: string | null;
  year: string | null;
  semester: string | null;
  downloaded_at: string;
}

const DownloadsPage = () => {
  const { token, user } = useAuth();
  const [downloads, setDownloads] = useState<DownloadItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [alert, setAlert] = useState<{ show: boolean; title: string; message: string; variant: 'success' | 'error' | 'info' }>({
    show: false,
    title: '',
    message: '',
    variant: 'info'
  });

  const isPaid = ['basic', 'plus', 'pro'].includes(user?.plan?.toLowerCase() || '');
  const planLabel = (user?.plan || 'free').charAt(0).toUpperCase() + (user?.plan || 'free').slice(1).toLowerCase();

  useEffect(() => {
    const fetchDownloads = async () => {
      try {
        setLoading(true);
        const res = await apiFetch('/papers/downloads/list', { token: token! });
        if (res.downloads) {
          setDownloads(res.downloads);
        }
      } catch (err) {
        // silently fail
      } finally {
        setLoading(false);
      }
    };

    if (token) fetchDownloads();
  }, [token]);

  const handleRemove = async (downloadId: string) => {
    setRemovingId(downloadId);
    try {
      await apiFetch(`/papers/downloads/${downloadId}`, { method: 'DELETE', token: token! });
      setDownloads(prev => prev.filter(d => d.id !== downloadId));
      setAlert({
        show: true,
        title: 'Removed',
        message: 'Paper removed from your downloads.',
        variant: 'success'
      });
    } catch {
      setAlert({
        show: true,
        title: 'Error',
        message: 'Failed to remove paper. Please try again.',
        variant: 'error'
      });
    } finally {
      setRemovingId(null);
    }
  };

  const handleReDownload = async (paperId: string, paperTitle: string) => {
    if (!isPaid) {
      setAlert({
        show: true,
        title: 'Upgrade Required',
        message: 'Device downloads are available on Basic, Plus, and Pro plans. Upgrade to download papers to your device.',
        variant: 'info'
      });
      return;
    }

    setDownloadingId(paperId);
    try {
      const fileName = paperTitle
        ? `${paperTitle.replace(/[^a-zA-Z0-9_\- ]/g, '').trim()}.pdf`
        : 'past-question.pdf';

      const blob = await apiDownload(`/papers/${paperId}/download`, token!);
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    } catch (err: any) {
      setAlert({
        show: true,
        title: 'Download Error',
        message: err.message || 'Failed to download the paper.',
        variant: 'error'
      });
    } finally {
      setDownloadingId(null);
    }
  };

  const filteredDownloads = downloads.filter(d => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      d.paper_title?.toLowerCase().includes(q) ||
      d.subject_name?.toLowerCase().includes(q) ||
      d.subject_code?.toLowerCase().includes(q) ||
      d.year?.includes(q)
    );
  });

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const gradients = [
    "from-indigo-500 via-purple-500 to-pink-500",
    "from-cyan-500 via-blue-500 to-indigo-500",
    "from-emerald-500 via-teal-500 to-cyan-500",
    "from-amber-500 via-orange-500 to-rose-500",
    "from-fuchsia-500 via-pink-500 to-rose-500"
  ];

  return (
    <div className="w-full flex-grow flex flex-col px-4 md:px-8 max-w-7xl mx-auto py-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/25">
              <FolderDown className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl md:text-4xl font-bold text-theme-primary">My Downloads</h1>
              <p className="text-theme-muted text-sm">
                {downloads.length} paper{downloads.length !== 1 ? 's' : ''} in your library
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full md:w-auto">
          {/* Plan Badge */}
          <div className={clsx(
            "flex items-center gap-2 px-4 py-2 rounded-xl border text-xs font-black uppercase tracking-widest shrink-0",
            isPaid
              ? "bg-gradient-to-r from-amber-500/10 to-orange-500/10 border-amber-500/30 text-amber-400"
              : "bg-theme-surface border-theme-border text-theme-muted"
          )}>
            <Crown className={clsx("w-3.5 h-3.5", isPaid ? "text-amber-400" : "text-theme-muted")} />
            {planLabel}
            {isPaid && <span className="text-[8px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded-full font-black">DEVICE DL</span>}
          </div>

          {/* Search */}
          <div className="relative w-full sm:w-64 lg:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-theme-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search downloads..."
              className="w-full bg-theme-surface border border-theme-border rounded-xl py-2.5 pl-9 pr-4 text-sm text-theme-primary placeholder-gray-500 focus:outline-none focus:border-indigo-400/50 transition-all shadow-sm"
            />
          </div>
        </div>
      </div>

      {/* Free User Banner */}
      {!isPaid && downloads.length > 0 && (
        <div className="glass-card p-5 mb-8 border-amber-500/20 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-br from-amber-500/10 to-orange-500/5 blur-3xl -mr-20 -mt-20" />
          <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                <Crown className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <p className="text-sm font-bold text-theme-primary">Papers are view-only on the Free plan</p>
                <p className="text-xs text-theme-muted">Upgrade to download papers directly to your device</p>
              </div>
            </div>
            <Link
              to="/upgrade"
              className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-black uppercase tracking-widest rounded-xl hover:shadow-lg hover:shadow-amber-500/25 transition-all hover:scale-105 active:scale-95 flex items-center gap-2 shrink-0"
            >
              Upgrade Now <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="flex justify-center items-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
        </div>
      ) : (
        <>
          {/* Empty State */}
          {downloads.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center gap-6 glass-card border-dashed">
              <div className="w-20 h-20 bg-indigo-500/10 rounded-3xl flex items-center justify-center text-indigo-400 border border-indigo-500/20 relative">
                <FolderDown size={32} className="relative z-10" />
                <div className="absolute inset-0 bg-indigo-500/20 blur-2xl rounded-full animate-pulse" />
              </div>
              <div className="space-y-2 px-4">
                <h3 className="text-2xl font-bold text-theme-primary">No Downloads Yet</h3>
                <p className="text-theme-muted max-w-md mx-auto">
                  When you download a paper, it will appear here so you can access it anytime without using your download quota again.
                </p>
              </div>
              <Link
                to="/papers"
                className="px-6 py-2.5 bg-indigo-500 text-white rounded-xl font-bold hover:bg-indigo-600 transition-all shadow-lg shadow-indigo-500/25 active:scale-95 flex items-center gap-2"
              >
                <BookOpen className="w-4 h-4" />
                Browse Papers
              </Link>
            </div>
          )}

          {/* Search empty state */}
          {downloads.length > 0 && filteredDownloads.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center gap-4">
              <div className="w-16 h-16 bg-theme-surface-2 rounded-2xl flex items-center justify-center text-theme-muted border border-theme-border">
                <Search size={28} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-theme-primary mb-1">No results found</h3>
                <p className="text-sm text-theme-muted max-w-xs mx-auto">
                  No downloaded papers match "{searchQuery}"
                </p>
              </div>
            </div>
          )}

          {/* Downloads Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredDownloads.map((item, index) => {
              const gradient = gradients[index % gradients.length];
              return (
                <div
                  key={item.id}
                  className="glass-card p-5 group flex flex-col hover:translate-y-[-4px] hover:shadow-[0_20px_40px_rgba(0,0,0,0.4),0_0_20px_rgba(99,102,241,0.15)] transition-all duration-500 border-theme-border/50 relative overflow-hidden bg-gradient-to-b from-theme-surface to-theme-surface-2"
                >
                  {/* Background glow */}
                  <div className={`absolute top-0 right-0 w-36 h-36 bg-gradient-to-br ${gradient} opacity-[0.04] blur-3xl -mr-14 -mt-14 group-hover:opacity-[0.12] transition-opacity duration-700`} />

                  {/* Header: Icon + Year + Semester */}
                  <div className="flex justify-between items-start mb-4 relative z-10">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${gradient} p-[1px] shadow-lg group-hover:scale-110 transition-transform duration-500`}>
                        <div className="w-full h-full bg-theme-surface rounded-xl flex items-center justify-center">
                          <FileText className="w-5 h-5 text-indigo-400" />
                        </div>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-base font-black text-theme-primary leading-none">{item.year || '—'}</span>
                        <span className="text-[9px] text-theme-muted font-bold tracking-tighter uppercase">
                          {item.semester ? `${item.semester} Sem` : 'N/A'}
                        </span>
                      </div>
                    </div>

                    {/* Subject Code Pill */}
                    {item.subject_code && (
                      <div className="inline-flex items-center px-2 py-0.5 rounded bg-theme-surface border border-theme-border text-[8px] font-black tracking-widest text-indigo-400 uppercase">
                        {item.subject_code}
                      </div>
                    )}
                  </div>

                  {/* Title */}
                  <div className="relative z-10 mb-3 flex-grow">
                    <h3 className="text-sm md:text-base font-bold text-theme-primary leading-snug line-clamp-2 group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-indigo-400 group-hover:to-purple-400 transition-all duration-300">
                      {item.paper_title}
                    </h3>
                    {item.subject_name && (
                      <p className="text-[11px] text-theme-muted font-semibold mt-1.5 truncate">{item.subject_name}</p>
                    )}
                  </div>

                  {/* Footer: Date + Actions */}
                  <div className="mt-auto pt-4 border-t border-theme-border/30 flex items-center justify-between relative z-10">
                    <div className="flex items-center gap-1.5 text-[10px] text-theme-muted font-semibold">
                      <Clock className="w-3 h-3" />
                      {formatDate(item.downloaded_at)}
                    </div>

                    <div className="flex gap-1.5">
                      {/* View Paper */}
                      <Link
                        to={`/papers/${item.paper_id}`}
                        className="w-8 h-8 flex items-center justify-center rounded-lg bg-theme-surface border border-theme-border text-theme-secondary hover:text-indigo-400 hover:border-indigo-500/30 transition-all"
                        title="View Paper"
                      >
                        <Eye className="w-4 h-4" />
                      </Link>

                      {/* Re-download to device */}
                      <button
                        onClick={() => handleReDownload(item.paper_id, item.paper_title)}
                        disabled={downloadingId !== null}
                        className={clsx(
                          "w-8 h-8 flex items-center justify-center rounded-lg border transition-all",
                          isPaid
                            ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-400 hover:bg-indigo-500 hover:text-white"
                            : "bg-theme-surface border-theme-border text-theme-muted/40 cursor-not-allowed"
                        )}
                        title={isPaid ? "Download to device" : "Upgrade to download to device"}
                      >
                        {downloadingId === item.paper_id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Download className="w-4 h-4" />
                        )}
                      </button>

                      {/* Remove from panel */}
                      <button
                        onClick={() => handleRemove(item.id)}
                        disabled={removingId !== null}
                        className="w-8 h-8 flex items-center justify-center rounded-lg bg-theme-surface border border-theme-border text-theme-muted hover:text-red-400 hover:border-red-500/30 transition-all"
                        title="Remove from downloads"
                      >
                        {removingId === item.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Alert Modal */}
      <AlertModal
        isOpen={alert.show}
        onClose={() => setAlert({ ...alert, show: false })}
        title={alert.title}
        message={alert.message}
        variant={alert.variant}
      />
    </div>
  );
};

export default DownloadsPage;
