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
   * Validate identifier (table/column name) to prevent SQL injection
   * Only allows alphanumeric, underscore, and dollar sign
   * @param {string} identifier - The identifier to validate
   * @param {string} type - Type of identifier for error messages
   * @throws {Error} If identifier contains invalid characters
   */
  static validateIdentifier(identifier, type = 'identifier') {
    if (!identifier || typeof identifier !== 'string') {
      throw new Error(`Invalid ${type}: must be a non-empty string`);
    }
    
    // PostgreSQL identifier rules: alphanumeric, underscore, dollar sign
    // Cannot start with a number (unless quoted, which we always do)
    const validPattern = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/;
    
    if (!validPattern.test(identifier)) {
      throw new Error(
        `Invalid ${type} "${identifier}": ` +
        `Only alphanumeric characters, underscores, and dollar signs are allowed`
      );
    }
    
    // Check for SQL keywords that shouldn't be used as identifiers
    const reservedWords = ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'DROP', 'ALTER', 'CREATE'];
    if (reservedWords.includes(identifier.toUpperCase())) {
      throw new Error(`Invalid ${type} "${identifier}": Cannot use SQL keyword as identifier`);
    }
    
    return identifier;
  }
  
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
   * @param {string} type - Column type (should be hardcoded, not user input)
   * @param {string} defaultValue - Default value (optional, should be hardcoded)
   */
  static addColumn(table, column, type, defaultValue = null) {
    // Validate identifiers to prevent SQL injection
    const safeTable = this.validateIdentifier(table, 'table name');
    const safeColumn = this.validateIdentifier(column, 'column name');
    
    // Type and defaultValue should be hardcoded in migration definitions
    // They're not validated here because they need to support complex SQL types
    // e.g., "TEXT[]", "VARCHAR(255)", "INTEGER DEFAULT 0"
    let sql = `ALTER TABLE "${safeTable}" ADD COLUMN IF NOT EXISTS "${safeColumn}" ${type}`;
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
    // Validate identifiers to prevent SQL injection
    const safeTable = this.validateIdentifier(table, 'table name');
    const safeColumn = this.validateIdentifier(column, 'column name');
    
    return this.ddl(`ALTER TABLE "${safeTable}" DROP COLUMN IF EXISTS "${safeColumn}"`);
  }
  
  /**
   * Create a CREATE TABLE statement
   * @param {string} table - Table name
   * @param {string} definition - Table definition (should be hardcoded SQL)
   */
  static createTable(table, definition) {
    // Validate table name to prevent SQL injection
    const safeTable = this.validateIdentifier(table, 'table name');
    
    // Definition should be hardcoded SQL in migration files
    // Not validated because it needs to support complex table definitions
    return this.ddl(`CREATE TABLE IF NOT EXISTS "${safeTable}" (${definition})`);
  }
}

module.exports = MigrationSQL;