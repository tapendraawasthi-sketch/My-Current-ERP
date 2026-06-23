import { AppDataSource, initializeDataSource } from '../data-source';

export async function seedDefaultCoA() {
  const dataSource = await initializeDataSource();
  
  // Only seed if no data exists
  const existingGroups = await dataSource.query(
    `SELECT COUNT(*) as count FROM account_groups`
  );
  
  if (existingGroups[0].count > 0) {
    console.log('⏭️  Chart of Accounts already seeded, skipping');
    return;
  }
  
  const defaultGroups = [
    // Liabilities
    { name: 'Capital Account', nature: 'liability', parent: null },
    { name: 'Loans (Liability)', nature: 'liability', parent: null },
    { name: 'Current Liabilities & Provisions', nature: 'liability', parent: null },
    { name: 'Sundry Creditors', nature: 'liability', parent: 'Current Liabilities & Provisions' },
    { name: 'Duties & Taxes', nature: 'liability', parent: 'Current Liabilities & Provisions' },
    
    // Assets
    { name: 'Fixed Assets', nature: 'asset', parent: null },
    { name: 'Current Assets', nature: 'asset', parent: null },
    { name: 'Sundry Debtors', nature: 'asset', parent: 'Current Assets' },
    { name: 'Cash-in-hand', nature: 'asset', parent: 'Current Assets' },
    { name: 'Bank Accounts', nature: 'asset', parent: 'Current Assets' },
    
    // Income
    { name: 'Sales Accounts', nature: 'income', parent: null },
    { name: 'Direct Income', nature: 'income', parent: null },
    
    // Expenses
    { name: 'Purchase Accounts', nature: 'expense', parent: null },
    { name: 'Expenses (Indirect)', nature: 'expense', parent: null },
  ];
  
  for (const group of defaultGroups) {
    await dataSource.query(
      `INSERT INTO account_groups (company_id, name, nature, parent_id)
       VALUES (
         (SELECT id FROM companies LIMIT 1),
         $1,
         $2,
         (SELECT id FROM account_groups WHERE name = $3 AND company_id = (SELECT id FROM companies LIMIT 1) LIMIT 1)
       )`,
      [group.name, group.nature, group.parent]
    );
  }
  
  console.log('✅ Default Chart of Accounts seeded');
}
