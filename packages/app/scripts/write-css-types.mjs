import { writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

await writeFile(resolve('dist/styles.css.d.ts'), "declare const css: string\nexport default css\n")
