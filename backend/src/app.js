// backend/src/app.js

const express      = require('express');
const cors         = require('cors');
const helmet       = require('helmet');
const path         = require('path');
const errorHandler = require('./middlewares/errorHandler');
const { verifyToken } = require('./middlewares/auth.middleware');

const app = express();

app.set('trust proxy', 1); // derrière nginx
app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173', credentials: true }));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use((req, res, next) => {
  // Masquer ?token= dans les logs pour éviter la fuite de JWT
  const safeUrl = req.url.replace(/([?&]token=)[^&]*/g, '$1[REDACTED]');
  console.log(`[${new Date().toISOString()}] ${req.method} ${safeUrl}`);
  next();
});

// ── Fichiers uploadés — protégés par JWT (gels PCR, .ab1/.fastq)
app.use('/api/v1/uploads', verifyToken, express.static(path.join(__dirname, '..', 'uploads')));

// ── Health check ──────────────────────────────────────────────
app.get('/api/health', (req, res) => res.json({ status: 'ok', app: 'SpécimenManager API', version: '1.0.0' }));

// ── Routes ────────────────────────────────────────────────────
app.use('/api/v1/auth',       require('./routes/auth.routes'));
app.use('/api/v1/rbac',       require('./routes/rbac.routes'));
app.use('/api/v1/projets',    require('./routes/projets.routes'));
app.use('/api/v1/missions',   require('./routes/missions.routes'));
app.use('/api/v1/localites',  require('./routes/localites.routes'));
app.use('/api/v1/methodes',   require('./routes/methodes.routes'));
app.use('/api/v1/hotes',      require('./routes/hotes.routes'));
app.use('/api/v1/containers', require('./routes/containers.routes'));
app.use('/api/v1/moustiques',        require('./routes/specimens/moustiques.routes'));
app.use('/api/v1/tiques',           require('./routes/specimens/tiques.routes'));
app.use('/api/v1/puces',            require('./routes/specimens/puces.routes'));
app.use('/api/v1/autres-specimens', require('./routes/specimens/autresSpecimens.routes'));
app.use('/api/v1/labo',             require('./routes/labo.routes'));
app.use('/api/v1/pools',            require('./routes/pools.routes'));

app.use('/api/v1/dictionnaire/taxonomie-specimens',    require('./routes/dictionnaire/taxonomieSpecimens.routes'));
app.use('/api/v1/dictionnaire/taxonomie-hotes',        require('./routes/dictionnaire/taxonomieHotes.routes'));
app.use('/api/v1/dictionnaire/types-methode',          require('./routes/dictionnaire/typesMethode.routes'));
app.use('/api/v1/dictionnaire/solutions-conservation', require('./routes/dictionnaire/solutionsConservation.routes'));
app.use('/api/v1/dictionnaire/types-environnement',    require('./routes/dictionnaire/typesEnvironnement.routes'));
app.use('/api/v1/dictionnaire/types-habitat',           require('./routes/dictionnaire/typesHabitat.routes'));
app.use('/api/v1/dictionnaire/audit-logs',             require('./routes/dictionnaire/auditLogs.routes'));
app.use('/api/v1/dictionnaire/types-autre-specimen',   require('./routes/dictionnaire/typesAutreSpecimen.routes'));
app.use('/api/v1/dictionnaire/pathogenes-cibles',      require('./routes/dictionnaire/pathogenesCibles.routes'));

app.use('/api/v1/notifications', require('./routes/notifications.routes'));
app.use('/api/v1/recherche',     require('./routes/recherche.routes'));
app.use('/api/v1/import',     require('./routes/import.routes'));
app.use('/api/v1/carte',      require('./routes/carte.routes'));
app.use('/api/v1/dashboard',  require('./routes/dashboard.routes'));

// ── 404 ───────────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ error: 'Route introuvable' }));

// ── Error handler global (doit être en dernier) ───────────────
app.use(errorHandler);

module.exports = app;
