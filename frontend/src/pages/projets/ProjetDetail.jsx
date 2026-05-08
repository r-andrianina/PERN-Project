import { useParams, Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { ChevronLeft, FolderOpen, MapPin, Tag, ChevronRight, User, Calendar } from 'lucide-react';
import api from '../../api/axios';
import { Card, Badge, EmptyState, Spinner } from '../../components/ui';

const STATUT_TONE  = { actif: 'success', termine: 'default', suspendu: 'warning' };
const STATUT_LABEL = { actif: 'Actif', termine: 'Terminé', suspendu: 'Suspendu' };
const MISSION_TONE = { planifiee: 'info', en_cours: 'success', terminee: 'default', annulee: 'danger' };
const MISSION_LABEL = { planifiee: 'Planifiée', en_cours: 'En cours', terminee: 'Terminée', annulee: 'Annulée' };

export default function ProjetDetail() {
  const { id } = useParams();
  const [projet, setProjet] = useState(null);

  useEffect(() => { api.get(`/projets/${id}`).then(r => setProjet(r.data.projet)); }, [id]);

  if (!projet) return <Spinner.Block label="Chargement…" height="h-40" />;

  return (
    <div className="max-w-3xl space-y-5">
      <Link to="/projets" className="inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg transition-colors">
        <ChevronLeft size={16} /> Projets
      </Link>

      {/* Carte principale */}
      <Card padding="md">
        <div className="flex items-start gap-4 mb-4">
          <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            <FolderOpen size={20} className="text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap mb-1">
              <span className="inline-flex items-center gap-1 text-xs font-mono bg-surface-2 text-fg-muted px-2 py-0.5 rounded-lg border border-border">
                <Tag size={10} /> {projet.code}
              </span>
              <Badge tone={STATUT_TONE[projet.statut] ?? 'default'} dot>
                {STATUT_LABEL[projet.statut] ?? projet.statut}
              </Badge>
            </div>
            <h1 className="text-xl font-bold text-fg">{projet.nom}</h1>
          </div>
        </div>

        {projet.description && (
          <p className="text-sm text-fg-muted bg-surface-2 rounded-xl px-4 py-3 border border-border mt-2">
            {projet.description}
          </p>
        )}

        <div className="grid grid-cols-2 gap-3 mt-4">
          {(projet.porteur || projet.responsable) && (
            <div className="text-xs">
              <p className="text-fg-subtle font-medium mb-0.5 flex items-center gap-1"><User size={11} /> Porteur</p>
              <p className="text-fg">
                {projet.porteur || `${projet.responsable.prenom} ${projet.responsable.nom}`}
              </p>
            </div>
          )}
          {projet.dateDebut && (
            <div className="text-xs">
              <p className="text-fg-subtle font-medium mb-0.5 flex items-center gap-1"><Calendar size={11} /> Période</p>
              <p className="text-fg">
                {new Date(projet.dateDebut).toLocaleDateString('fr-FR')}
                {projet.dateFin && ` → ${new Date(projet.dateFin).toLocaleDateString('fr-FR')}`}
              </p>
            </div>
          )}
        </div>
      </Card>

      {/* Missions */}
      <Card padding="none" className="overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
          <MapPin size={16} className="text-primary" />
          <h2 className="text-sm font-semibold text-fg">
            Missions
            <span className="ml-2 text-xs font-normal text-fg-subtle">({projet.missions?.length ?? 0})</span>
          </h2>
        </div>

        {projet.missions?.length === 0 ? (
          <div className="py-10">
            <EmptyState icon={MapPin} title="Aucune mission associée" />
          </div>
        ) : (
          <div className="divide-y divide-border">
            {projet.missions?.map(m => (
              <Link key={m.id} to={`/missions/${m.id}`}
                className="flex items-center justify-between px-5 py-3.5 hover:bg-surface-2 transition-colors group">
                <div>
                  <p className="text-sm font-medium text-fg group-hover:text-primary transition-colors">
                    {m.ordreMission}
                  </p>
                  <p className="text-xs text-fg-subtle mt-0.5">{m._count?.localites ?? 0} localité(s)</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={MISSION_TONE[m.statut] ?? 'default'} dot>
                    {MISSION_LABEL[m.statut] ?? m.statut}
                  </Badge>
                  <ChevronRight size={14} className="text-fg-subtle group-hover:text-primary transition-colors" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
