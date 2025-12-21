import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getAdminPlan } from '../../api';
import { Eye, FileText, ArrowLeft, Pencil } from 'lucide-react';

function resolveMediaUrl(path?: string) {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  const cleanedPath = path.replace(/^\/api(?=\/)/, '');
  return cleanedPath.startsWith('/') ? cleanedPath : `/${cleanedPath}`;
}

function isImagePath(path?: string) {
  if (!path) return false;
  const lower = path.toLowerCase();
  return (
    lower.endsWith('.png') ||
    lower.endsWith('.jpg') ||
    lower.endsWith('.jpeg') ||
    lower.endsWith('.gif') ||
    lower.endsWith('.webp')
  );
}

function FileList({ title, paths }: { title: string; paths: string[] }) {
  if (!paths.length) return null;
  return (
    <div className="bg-white p-4 rounded-lg border border-gray-200">
      <div className="font-semibold text-gray-900 mb-2">{title}</div>
      <div className="space-y-1 text-sm">
        {paths.map((p, idx) => (
          <a
            key={`${p}-${idx}`}
            href={resolveMediaUrl(p)}
            target="_blank"
            rel="noreferrer"
            className="block text-blue-700 hover:underline break-all"
          >
            {p}
          </a>
        ))}
      </div>
    </div>
  );
}

function ImageGrid({ title, paths }: { title: string; paths: string[] }) {
  if (!paths.length) return null;
  return (
    <div className="bg-white p-4 rounded-lg border border-gray-200">
      <div className="font-semibold text-gray-900 mb-2">{title}</div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {paths.map((p, idx) => (
          <a
            key={`${p}-${idx}`}
            href={resolveMediaUrl(p)}
            target="_blank"
            rel="noreferrer"
            className="block"
          >
            <img src={resolveMediaUrl(p)} alt={title} className="w-full h-28 object-cover rounded border" />
          </a>
        ))}
      </div>
    </div>
  );
}

export default function AdminPlanView() {
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [plan, setPlan] = useState<any>(null);

  useEffect(() => {
    if (!id) return;
    const run = async () => {
      try {
        setLoading(true);
        const resp = await getAdminPlan(id);
        setPlan(resp.data);
      } catch (e: any) {
        setError(e?.response?.data?.message || e?.message || 'Failed to load plan');
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [id]);

  const filePaths = useMemo(() => {
    const fp = plan?.file_paths;
    return fp && typeof fp === 'object' ? fp : {};
  }, [plan]);

  const thumbnailPath = useMemo(() => {
    return plan?.image_url || filePaths?.thumbnail || '';
  }, [plan, filePaths]);

  const gallery = useMemo(() => (Array.isArray(filePaths?.gallery) ? filePaths.gallery : []), [filePaths]);
  const renders = useMemo(() => (Array.isArray(filePaths?.renders) ? filePaths.renders : []), [filePaths]);

  const renderImages = useMemo(() => renders.filter((p: any) => typeof p === 'string' && isImagePath(p)), [renders]);
  const renderNonImages = useMemo(() => renders.filter((p: any) => typeof p === 'string' && !isImagePath(p)), [renders]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-5xl mx-auto px-4">
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg">{error}</div>
          <div className="mt-4">
            <Link to="/admin/plans" className="text-blue-700 hover:underline inline-flex items-center gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back to Plan Management
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!plan) return null;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex items-center justify-between gap-4 mb-6">
          <div>
            <div className="text-sm text-gray-600">
              <Link to="/admin/plans" className="text-blue-700 hover:underline inline-flex items-center gap-2">
                <ArrowLeft className="w-4 h-4" />
                Back to Plan Management
              </Link>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mt-2 flex items-center gap-2">
              <Eye className="w-7 h-7 text-blue-600" />
              Admin Plan View
            </h1>
            <div className="text-gray-700 mt-1 font-medium">{plan.name}</div>
            <div className="text-sm text-gray-600 mt-1">
              Status: <span className="font-semibold">{plan.status}</span> | Category: <span className="font-semibold">{plan.category}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              to={`/designer/upload?edit=${plan.id}`}
              className="px-3 py-2 rounded bg-purple-600 text-white hover:bg-purple-700 inline-flex items-center gap-2"
            >
              <Pencil className="w-4 h-4" />
              Edit
            </Link>
            <Link
              to={`/plans/${plan.id}`}
              className="px-3 py-2 rounded bg-white border border-gray-200 text-gray-800 hover:bg-gray-50 inline-flex items-center gap-2"
              title="Open customer view"
            >
              <FileText className="w-4 h-4" />
              Customer View
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="text-sm text-gray-600">Designer</div>
            <div className="font-semibold text-gray-900">{plan.designer_name || plan.designer_id || '-'}</div>
          </div>
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="text-sm text-gray-600">Price</div>
            <div className="font-semibold text-gray-900">{plan.price != null ? `$ ${Number(plan.price).toLocaleString()}` : '-'}</div>
          </div>
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="text-sm text-gray-600">Created</div>
            <div className="font-semibold text-gray-900">{plan.created_at || '-'}</div>
          </div>
        </div>

        {thumbnailPath && isImagePath(thumbnailPath) && (
          <div className="bg-white p-4 rounded-lg border border-gray-200 mb-6">
            <div className="font-semibold text-gray-900 mb-2">Thumbnail</div>
            <a href={resolveMediaUrl(thumbnailPath)} target="_blank" rel="noreferrer" className="inline-block">
              <img src={resolveMediaUrl(thumbnailPath)} alt="thumbnail" className="w-full max-w-md h-56 object-cover rounded border" />
            </a>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ImageGrid title="Gallery" paths={gallery.filter((p: any) => typeof p === 'string' && isImagePath(p))} />

          <div className="space-y-4">
            <ImageGrid title="Renders" paths={renderImages} />
            <FileList title="Renders (non-images)" paths={renderNonImages} />
          </div>

          <FileList title="Architectural" paths={Array.isArray(filePaths?.architectural) ? filePaths.architectural : []} />
          <FileList title="Structural" paths={Array.isArray(filePaths?.structural) ? filePaths.structural : []} />
          <FileList title="MEP" paths={Array.isArray(filePaths?.mep) ? filePaths.mep : []} />
          <FileList title="Civil" paths={Array.isArray(filePaths?.civil) ? filePaths.civil : []} />
          <FileList title="Fire Safety" paths={Array.isArray(filePaths?.fire_safety) ? filePaths.fire_safety : []} />
          <FileList title="Interior" paths={Array.isArray(filePaths?.interior) ? filePaths.interior : []} />
          <FileList title="BOQ" paths={Array.isArray(filePaths?.boq) ? filePaths.boq : []} />
        </div>

        {Array.isArray(plan?.files) && plan.files.length > 0 && (
          <div className="bg-white p-4 rounded-lg border border-gray-200 mt-6">
            <div className="font-semibold text-gray-900 mb-2">Plan Files (Raw)</div>
            <div className="text-sm text-gray-700 space-y-1">
              {plan.files.map((f: any, idx: number) => {
                const p = f?.file_path || f?.filePath;
                return (
                  <div key={`${p || 'file'}-${idx}`} className="flex items-center justify-between gap-3">
                    <a href={resolveMediaUrl(p)} target="_blank" rel="noreferrer" className="text-blue-700 hover:underline break-all">
                      {String(f?.file_type || f?.fileType || 'FILE')}: {p}
                    </a>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
