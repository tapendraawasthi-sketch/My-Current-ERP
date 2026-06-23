import { MigrationInterface, QueryRunner, Table, Index } from 'typeorm';

export class CreateAccountsTable2000000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Account groups
    await queryRunner.createTable(
      new Table({
        name: 'account_groups',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, default: 'uuid_generate_v4()' },
          { name: 'company_id', type: 'uuid', isNullable: false },
          { name: 'parent_id', type: 'uuid', isNullable: true },
          { name: 'name', type: 'varchar', length: '100', isNullable: false },
          { name: 'nature', type: 'varchar', length: '20', isNullable: false }, // asset, liability, income, expense
          { name: 'sort_order', type: 'int', default: 0 },
        ],
        foreignKeys: [
          {
            columnNames: ['company_id'],
            referencedTableName: 'companies',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
          {
            columnNames: ['parent_id'],
            referencedTableName: 'account_groups',
            referencedColumnNames: ['id'],
            onDelete: 'SET NULL',
          },
        ],
      }),
      true
    );
    
    // Ledgers (accounts)
    await queryRunner.createTable(
      new Table({
        name: 'ledgers',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, default: 'uuid_generate_v4()' },
          { name: 'company_id', type: 'uuid', isNullable: false },
          { name: 'fy_id', type: 'uuid', isNullable: false },
          { name: 'group_id', type: 'uuid', isNullable: false },
          { name: 'name', type: 'varchar', length: '100', isNullable: false },
          { name: 'alias', type: 'varchar', length: '30', isNullable: true },
          { name: 'op_balance', type: 'numeric', precision: 15, scale: 2, default: 0 },
          { name: 'op_dr_cr', type: 'char', length: 1, default: "'D'" }, // D=Debit, C=Credit
          { name: 'gstin', type: 'varchar', length: '15', isNullable: true },
          { name: 'pan', type: 'varchar', length: '10', isNullable: true },
          { name: 'bill_by_bill', type: 'boolean', default: false },
          { name: 'credit_days', type: 'int', default: 0 },
          { name: 'is_active', type: 'boolean', default: true },
          { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
        ],
        foreignKeys: [
          {
            columnNames: ['company_id'],
            referencedTableName: 'companies',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
          {
            columnNames: ['group_id'],
            referencedTableName: 'account_groups',
            referencedColumnNames: ['id'],
          },
          {
            columnNames: ['fy_id'],
            referencedTableName: 'fiscal_years',
            referencedColumnNames: ['id'],
          },
        ],
        indices: [
          {
            name: 'idx_ledgers_company_fy',
            columnNames: ['company_id', 'fy_id'],
          },
        ],
      }),
      true
    );
  }
  
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('ledgers');
    await queryRunner.dropTable('account_groups');
  }
}
