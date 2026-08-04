-- Authentication is stateless JWT. Legacy opaque cookies stop working when the
-- API switches, so no database-backed authentication sessions remain to keep.
DROP TABLE IF EXISTS sessions;
