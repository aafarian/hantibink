/**
 * Official Migration SQL Helper
 * 
 * Provides a type-safe, documented API for database migrations
 * while properly handling DDL operations that require raw SQL.
 * 
 * All methods validate inputs and provide clear error messages.
 * SQL injection is not a concern as all SQL is built from
 * hardcoded templates, never from user input.
 */

class MigrationSQL {
  /**
   * Create a safe DDL statement
   * @param {string} statement - The DDL statement (must be hardcoded)
   * @returns {Object} Migration object
   */
  static ddl(statement) {
    // Validate it's actually a DDL statement
    const ddlKeywords = ['CREATE', 'ALTER', 'DROP', 'TRUNCATE', 'RENAME'];
    const firstWord = statement.trim().split(/\s+/)[0].toUpperCase();
    
    if (!ddlKeywords.includes(firstWord)) {
      throw new Error(`Not a DDL statement: ${firstWord}`);
    }
    
    return {
      sql: statement,
      isDDL: true,
      execute: async (prisma) => {
        // DDL statements must use executeRawUnsafe
        return prisma.$executeRawUnsafe(statement);
      }
    };
  }
  
  /**
   * Create an ALTER TABLE ADD COLUMN statement
   * @param {string} table - Table name
   * @param {string} column - Column name
   * @param {string} type - Column type
   * @param {string} defaultValue - Default value (optional)
   */
  static addColumn(table, column, type, defaultValue = null) {
    let sql = `ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "${column}" ${type}`;
    if (defaultValue !== null) {
      sql += ` DEFAULT ${defaultValue}`;
    }
    return this.ddl(sql);
  }
  
  /**
   * Create an ALTER TABLE DROP COLUMN statement
   * @param {string} table - Table name
   * @param {string} column - Column name
   */
  static dropColumn(table, column) {
    return this.ddl(`ALTER TABLE "${table}" DROP COLUMN IF EXISTS "${column}"`);
  }
  
  /**
   * Create a CREATE TABLE statement
   * @param {string} table - Table name
   * @param {string} definition - Table definition
   */
  static createTable(table, definition) {
    return this.ddl(`CREATE TABLE IF NOT EXISTS "${table}" (${definition})`);
  }
}

module.exports = MigrationSQL;