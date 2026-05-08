const { z } = require('zod');

const emailStr    = z.string().email('Format email invalide').toLowerCase();
const passwordStr = z.string().min(8, 'Le mot de passe doit contenir au moins 8 caracteres');

const login = z.object({
  email:    emailStr,
  password: z.string().min(1, 'Mot de passe requis'),
});

const register = z.object({
  nom:      z.string().min(1, 'Nom requis').max(100).trim(),
  prenom:   z.string().min(1, 'Prenom requis').max(100).trim(),
  email:    emailStr,
  password: passwordStr,
});

const createUser = z.object({
  nom:      z.string().min(1).max(100).trim(),
  prenom:   z.string().min(1).max(100).trim(),
  email:    emailStr,
  password: passwordStr,
  role:     z.enum(['admin', 'chercheur', 'terrain', 'lecteur']).default('lecteur'),
  actif:    z.boolean().default(true),
});

const updateUser = z.object({
  nom:    z.string().min(1).max(100).trim().optional(),
  prenom: z.string().min(1).max(100).trim().optional(),
  email:  emailStr.optional(),
  role:   z.enum(['admin', 'chercheur', 'terrain', 'lecteur']).optional(),
}).refine((d) => Object.values(d).some((v) => v !== undefined), {
  message: 'Aucune modification fournie',
});

const activateUser = z.object({
  actif: z.boolean().optional(),
  role:  z.enum(['admin', 'chercheur', 'terrain', 'lecteur']).optional(),
}).refine((d) => d.actif !== undefined || d.role !== undefined, {
  message: 'actif ou role requis',
});

const resetPassword = z.object({
  password: passwordStr,
});

module.exports = { login, register, createUser, updateUser, activateUser, resetPassword };
