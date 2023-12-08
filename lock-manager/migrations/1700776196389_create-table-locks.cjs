exports.up = pgm => {
    pgm.createTable('locks', {
        lock_id: {type: 'varchar(255)', primaryKey: true},
        lock_metadata: {
            type: 'jsonb',
            notNull: true,
        },
    });
};

exports.down = pgm => {
    pgm.dropTable('locks');
};
