export default () => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  redis: {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
  },
  storage: {
    dir: process.env.STORAGE_DIR ?? './storage',
    fileTtlMinutes: parseInt(process.env.FILE_TTL_MINUTES ?? '60', 10),
  },
  maxFileSizeMb: parseInt(process.env.MAX_FILE_SIZE_MB ?? '50', 10),
});
