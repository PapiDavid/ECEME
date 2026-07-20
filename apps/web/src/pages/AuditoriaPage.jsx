import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { ScrollText, Search, RefreshCw, ArrowLeft, ShieldCheck, ShieldAlert } from 'lucide-react';
import Header from '@/components/Header.jsx';
import Footer from '@/components/Footer.jsx';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

// Página de AUDITORÍA (logs): rastreo de actividad de los usuarios del sistema.
// Solo accesible para el administrador (ruta protegida /admin/auditoria).
const AuditoriaPage = () => {
  const navigate = useNavigate();
  const [auditoria, setAuditoria] = useState([]);
  const [audSearch, setAudSearch] = useState('');
  const [audLoading, setAudLoading] = useState(false);
  // Resultado de la verificación de integridad de la cadena de logs
  const [verif, setVerif] = useState(null);
  const [verifLoading, setVerifLoading] = useState(false);

  // Recorre la bitácora en el backend recalculando los hashes SHA-256
  const handleVerificar = async () => {
    setVerifLoading(true);
    try {
      const { data } = await api.get('/admin/auditoria/verificar');
      setVerif(data);
    } catch (err) {
      toast.error('ERROR AL VERIFICAR LA INTEGRIDAD');
    } finally {
      setVerifLoading(false);
    }
  };

  const fetchAuditoria = async (q = audSearch) => {
    setAudLoading(true);
    try {
      const { data } = await api.get('/admin/auditoria', { params: q ? { q } : {} });
      setAuditoria(data);
    } catch (err) {
      toast.error('ERROR AL CARGAR LA AUDITORÍA');
    } finally {
      setAudLoading(false);
    }
  };

  useEffect(() => { fetchAuditoria(); }, []);
  // Vuelve a consultar cuando cambia el texto de búsqueda (filtra en el backend)
  useEffect(() => {
    const t = setTimeout(() => fetchAuditoria(audSearch), 350);
    return () => clearTimeout(t);
  }, [audSearch]);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Helmet><title>AUDITORÍA - ECEME</title></Helmet>
      <Header />

      <main className="flex-1 py-12 px-4 max-w-7xl mx-auto w-full">
        <div className="space-y-8">
          <div className="flex items-center justify-between border-b-4 border-primary pb-6">
            <div className="flex items-center space-x-4">
              <ScrollText size={32} className="text-primary" />
              <div>
                <h1 className="text-3xl font-black uppercase tracking-tighter text-foreground">Auditoría del Sistema</h1>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Rastreo de actividad de usuarios · últimos 200 eventos</p>
              </div>
            </div>
            <Button
              onClick={() => navigate('/admin')}
              variant="outline"
              className="border-2 border-primary font-black text-xs uppercase h-10 rounded-none">
              <ArrowLeft size={16} className="mr-2" /> Volver al panel
            </Button>
          </div>

          <div className="bg-card border-2 border-border p-6 shadow-xl">
            {/* Controles: buscador + refrescar */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-end gap-3 mb-6">
              <div className="relative flex-1 md:max-w-sm">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={audSearch}
                  onChange={e => setAudSearch(e.target.value)}
                  placeholder="BUSCAR POR USUARIO O ACCIÓN..."
                  className="pl-9 font-bold text-xs uppercase" />
              </div>
              <Button onClick={() => fetchAuditoria()} variant="outline" className="border-2 border-primary font-black text-xs uppercase h-10 rounded-none shrink-0">
                <RefreshCw size={16} className={`mr-2 ${audLoading ? 'animate-spin' : ''}`} /> Refrescar
              </Button>
              <Button onClick={handleVerificar} className="bg-primary text-primary-foreground font-black text-xs uppercase h-10 rounded-none border-b-4 border-black/20 shrink-0">
                <ShieldCheck size={16} className={`mr-2 ${verifLoading ? 'animate-pulse' : ''}`} /> Verificar integridad
              </Button>
            </div>

            {/* Resultado de la verificación: la bitácora está encadenada por
                SHA-256 igual que la blockchain de actas */}
            {verif && (
              verif.integra ? (
                <div className="mb-6 border-2 border-green-600 bg-green-600/10 p-4 flex items-center gap-3">
                  <ShieldCheck size={24} className="text-green-600 shrink-0" />
                  <div>
                    <p className="font-black uppercase text-sm text-green-600 tracking-widest">BITÁCORA ÍNTEGRA</p>
                    <p className="text-[10px] font-bold uppercase text-muted-foreground">
                      {verif.longitud} registro(s) verificados · cadena SHA-256 sin alteraciones
                    </p>
                  </div>
                </div>
              ) : (
                <div className="mb-6 border-2 border-destructive bg-destructive/10 p-4 flex items-center gap-3">
                  <ShieldAlert size={24} className="text-destructive shrink-0" />
                  <div>
                    <p className="font-black uppercase text-sm text-destructive tracking-widest">¡BITÁCORA ALTERADA!</p>
                    <p className="text-[10px] font-bold uppercase text-muted-foreground">
                      Cadena rota en el registro #{verif.primer_error?.id} ({verif.primer_error?.accion?.replaceAll('_', ' ')}) ·
                      motivo: {verif.primer_error?.motivo === 'DATOS_ALTERADOS' ? 'DATOS ALTERADOS' : 'ENLACE ROTO'}
                    </p>
                  </div>
                </div>
              )
            )}

            <div className="overflow-x-auto">
              <table className="military-table w-full">
                <thead>
                  <tr>
                    <th className="text-left text-[10px] uppercase">Fecha y hora</th>
                    <th className="text-left text-[10px] uppercase">Usuario</th>
                    <th className="text-left text-[10px] uppercase">Rol</th>
                    <th className="text-left text-[10px] uppercase">Acción</th>
                    <th className="text-left text-[10px] uppercase">Detalle</th>
                    <th className="text-left text-[10px] uppercase">IP</th>
                    <th className="text-left text-[10px] uppercase">Dispositivo</th>
                    <th className="text-left text-[10px] uppercase">Hash</th>
                  </tr>
                </thead>
                <tbody>
                  {auditoria.length === 0 ? (
                    <tr><td colSpan="8" className="text-center p-12 font-bold text-muted-foreground tracking-widest uppercase">
                      {audLoading ? 'Cargando registros...' : 'Sin actividad registrada'}
                    </td></tr>
                  ) : auditoria.map(log => (
                    <tr key={log.id} className="hover:bg-muted/30 transition-colors">
                      <td className="text-[10px] font-mono font-bold whitespace-nowrap py-3">
                        {new Date(log.fecha).toLocaleString('es-BO', { dateStyle: 'short', timeStyle: 'medium' })}
                      </td>
                      <td className="text-[11px] font-bold uppercase">{log.usuario_nombre}</td>
                      <td className="text-[9px] font-black uppercase text-muted-foreground">{log.rol || '—'}</td>
                      <td>
                        <span className="text-[9px] font-black uppercase bg-primary/10 text-primary px-2 py-1 rounded-sm whitespace-nowrap">
                          {log.accion.replaceAll('_', ' ')}
                        </span>
                      </td>
                      <td className="text-[10px] font-medium text-muted-foreground max-w-[280px]">{log.detalle || '—'}</td>
                      <td className="text-[10px] font-mono font-bold whitespace-nowrap">{log.ip || '—'}</td>
                      <td className="text-[10px] font-bold uppercase text-muted-foreground whitespace-nowrap">{log.dispositivo || '—'}</td>
                      <td className="text-[9px] font-mono text-muted-foreground whitespace-nowrap" title={log.hash || ''}>
                        {log.hash ? `${log.hash.slice(0, 10)}…` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default AuditoriaPage;
