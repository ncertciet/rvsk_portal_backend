import { MigrationInterface, QueryRunner } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';

export class SeedPortalData1723552800000 implements MigrationInterface {
  name = 'SeedPortalData1723552800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const initPath = path.join(
      __dirname,
      '../../../..',
      'ADW-SQL',
      'postgres_init.sql'
    );
    const masterSeedPath = path.join(
      __dirname,
      '../../../..',
      'ADW-SQL',
      'postgres_master_seed.sql'
    );

    try {
      // Check if tables already exist
      const result = await queryRunner.query(
        `SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'rvsk_portal' 
          AND table_name = 'portal_users'
        )`
      );
      
      const tablesExist = result[0]?.exists || false;

      if (!tablesExist) {
        console.log('Running schema initialization...');
        const initSQL = fs.readFileSync(initPath, 'utf8');
        const initStatements = this.parseSQL(initSQL);

        for (const statement of initStatements) {
          try {
            await queryRunner.query(statement);
          } catch (error) {
            const errorMsg = (error as any)?.message || String(error);
            if (
              errorMsg.includes('already exists') ||
              errorMsg.includes('duplicate')
            ) {
              console.log(`  (skipped already existing object)`);
            } else {
              throw error;
            }
          }
        }
        console.log('✓ Schema initialization completed');
      } else {
        console.log('✓ Schema already exists, skipping initialization');
      }

      console.log('Running master seed data...');
      const masterSeedSQL = fs.readFileSync(masterSeedPath, 'utf8');
      const masterSeedStatements = this.parseSQL(masterSeedSQL);

      for (const statement of masterSeedStatements) {
        await queryRunner.query(statement);
      }

      console.log('✓ Master seed data completed successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('✗ Error during migration:', errorMessage);
      throw error;
    }
  }

  private parseSQL(sql: string): string[] {
    // Remove comments and split by semicolon
    const lines = sql
      .split('\n')
      .map((line) => {
        // Remove single-line comments
        const commentIndex = line.indexOf('--');
        return commentIndex !== -1 ? line.substring(0, commentIndex) : line;
      })
      .join('\n');

    return lines
      .split(';')
      .map((stmt) => {
        // Clean up whitespace while preserving structure
        return stmt
          .trim()
          .split('\n')
          .map((l) => l.trim())
          .filter((l) => l.length > 0)
          .join('\n');
      })
      .filter((stmt) => stmt.length > 0);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    console.log('⚠ Seed migration rollback not implemented');
  }
}
