import { MigrationInterface, QueryRunner, Table, Index } from 'typeorm';

export class CreateTenantAndCompany1700000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Enable UUID extension
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    
    // Tenants table
    await queryRunner.createTable(
      new Table({
        name: 'tenants',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, default: 'uuid_generate_v4()' },
          { name: 'name', type: 'varchar', length: '100', isNullable: false },
          { name: 'plan', type: 'varchar', length: '20', default: "'standard'" },
          { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
          { name: 'updated_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' },
        ],
      }),
      true
    );
    
    // Companies table
    await queryRunner.createTable(
      new Table({
        name: 'companies',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, default: 'uuid_generate_v4()' },
          { name: 'tenant_id', type: 'uuid', isNullable: false },
          { name: 'name', type: 'varchar', length: '100', isNullable: false },
          { name: 'gstin', type: 'varchar', length: '15', isNullable: true, isUnique: true },
          { name: 'pan', type: 'varchar', length: '10', isNullable: true },
          { name: 'fy_beginning', type: 'date', isNullable: false },
          { name: 'fy_end', type: 'date', isNullable: false },
          { name: 'settings', type: 'jsonb', isNullable: true, default: "'{}'" },
          { name: 'is_active', type: 'boolean', default: true },
          { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
          { name: 'updated_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' },
        ],
        foreignKeys: [
          {
            columnNames: ['tenant_id'],
            referencedTableName: 'tenants',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
        indices: [
          {
            name: 'idx_companies_tenant',
            columnNames: ['tenant_id'],
          },
        ],
      }),
      true
    );
    
    // Fiscal years table
    await queryRunner.createTable(
      new Table({
        name: 'fiscal_years',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, default: 'uuid_generate_v4()' },
          { name: 'company_id', type: 'uuid', isNullable: false },
          { name: 'fy_label', type: 'varchar', length: '7', isNullable: false },
          { name: 'start_date', type: 'date', isNullable: false },
          { name: 'end_date', type: 'date', isNullable: false },
          { name: 'is_current', type: 'boolean', default: false },
          { name: 'is_closed', type: 'boolean', default: false },
          { name: 'closed_at', type: 'timestamp', isNullable: true },
          { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
        ],
        foreignKeys: [
          {
            columnNames: ['company_id'],
            referencedTableName: 'companies',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
        indices: [
          {
            name: 'idx_fiscal_years_company',
            columnNames: ['company_id', 'is_current'],
          },
        ],
      }),
      true
    );
  }
  
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('fiscal_years');
    await queryRunner.dropTable('companies');
    await queryRunner.dropTable('tenants');
  }
}
