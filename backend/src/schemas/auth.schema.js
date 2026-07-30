const { z } = require('zod');
const { ROLE_ORDER, SPECIMEN_TYPES, DEFAULT_SPECIMEN_ACCESS } = require('../config/rbac'); // source unique (F2)

const emailStr    = z.string().email('Format email invalide').toLowerCase();
const passwordStr = z.string().min(8, 'Le mot de passe doit contenir au moins 8 caracteres');
const roleEnum    = z.enum(ROLE_ORDER);
const specimensEnum = z.array(z.enum(SPECIMEN_TYPES));

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
  nom:               z.string().min(1).max(100).trim(),
  prenom:            z.string().min(1).max(100).trim(),
  email:             emailStr,
  password:          passwordStr,
  role:              roleEnum.default('lecteur'),
  actif:             z.boolean().default(true),
  specimensAutorises: specimensEnum.default(DEFAULT_SPECIMEN_ACCESS),
});

const updateUser = z.object({
  nom:    z.string().min(1).max(100).trim().optional(),
  prenom: z.string().min(1).max(100).trim().optional(),
  email:  emailStr.optional(),
  role:   roleEnum.optional(),
}).refine((d) => Object.values(d).some((v) => v !== undefined), {
  message: 'Aucune modification fournie',
});

const activateUser = z.object({
  actif: z.boolean().optional(),
  role:  roleEnum.optional(),
}).refine((d) => d.actif !== undefined || d.role !== undefined, {
  message: 'actif ou role requis',
});

const updateSpecimens = z.object({
  specimensAutorises: specimensEnum,
});

const resetPassword = z.object({
  password: passwordStr,
});

const changePassword = z.object({
  currentPassword: z.string().min(1, 'Mot de passe actuel requis'),
  newPassword:     passwordStr,
});

module.exports = { login, register, createUser, updateUser, activateUser, updateSpecimens, resetPassword, changePassword };
