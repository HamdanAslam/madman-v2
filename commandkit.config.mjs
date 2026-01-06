import { defineConfig } from 'commandkit/config';
import { cache } from '@commandkit/cache';

export default defineConfig({
  plugins: [cache()],
});
