import { defineCollection, z } from 'astro:content';

const ponentesCollection = defineCollection({
  type: 'content',
  schema: z.object({
    nombre: z.string(),
    rol: z.string(),
    fotoRetrato: z.string(), // URL de foto de retrato
    bio: z.string(),
    instagram: z.string().optional(),
    web: z.string().optional(),
    orden: z.number().default(99),
    galeria: z.array(z.object({
      url: z.string(),
      titulo: z.string().optional(),
    })).default([]),
  }),
});

const programaCollection = defineCollection({
  type: 'content',
  schema: z.object({
    dia: z.string(),
    fecha: z.string(),
    horarios: z.array(z.object({
      hora: z.string(),
      tipo: z.enum(['apertura', 'inauguracion', 'ponencia', 'break', 'taller', 'clausura', 'actividad']),
      titulo: z.string(),
      ponente: z.string().optional(),
      descripcion: z.string().optional(),
      destacado: z.boolean().default(false),
    })),
  }),
});

const talleresCollection = defineCollection({
  type: 'content',
  schema: z.object({
    titulo: z.string(),
    instructor: z.string(),
    fecha: z.string(),
    hora: z.string(),
    duracion: z.string(),
    aforo: z.string(),
    descripcion: z.string(),
    requisitos: z.array(z.string()).default([]),
    destacado: z.boolean().default(false),
  }),
});

export const collections = {
  ponentes: ponentesCollection,
  programa: programaCollection,
  talleres: talleresCollection,
};
