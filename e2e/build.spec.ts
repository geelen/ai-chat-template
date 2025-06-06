import { test, expect } from '@playwright/test'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

test.describe('Build Tests', () => {
  test('should build without type errors', async () => {
    try {
      const { stdout, stderr } = await execAsync('pnpm build', { 
        cwd: process.cwd(),
        timeout: 60000 
      })
      
      // Check for TypeScript compilation errors
      expect(stderr).not.toContain('error TS')
      expect(stderr).not.toContain('Type error')
      
      // Should complete successfully
      expect(stdout || stderr).toContain('built in')
      
    } catch (error: any) {
      // If build fails, the error message should be helpful
      console.error('Build failed:', error.stdout, error.stderr)
      throw new Error(`Build failed: ${error.message}`)
    }
  })

  test('should lint without errors', async () => {
    try {
      const { stdout, stderr } = await execAsync('pnpm lint', { 
        cwd: process.cwd(),
        timeout: 30000 
      })
      
      // ESLint should pass without errors
      expect(stderr).not.toContain('error')
      
    } catch (error: any) {
      console.error('Lint failed:', error.stdout, error.stderr)
      throw new Error(`Lint failed: ${error.message}`)
    }
  })
})
