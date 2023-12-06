
exports.up = pgm => {

    pgm.createTable('manage_locks', {
        lock_id: {type: 'varchar(255)', primaryKey: true},
        lock_metadata: {
            type: 'jsonb',
            notNull: true,
        },
    });

 
};

exports.down = pgm => {
    pgm.dropTable('manage_locks');
};
