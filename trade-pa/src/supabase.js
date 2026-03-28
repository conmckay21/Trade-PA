import { createClient } from '@supabase/supabase-js'
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```
→ Click **Commit changes**

**File 2 — Update `package.json`**:
Navigate to `trade-pa/package.json` → edit pencil → find the `"dependencies"` section → add this line:
```
"@supabase/supabase-js": "^2.39.0",
