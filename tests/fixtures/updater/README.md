# Updater verification fixtures

`fixture.txt` is deliberately harmless test data, signed for version `9.9.0`.
The signature and both public keys were generated specifically for these tests.
They are unrelated to the production signing key. No private key is included.

The tests verify the original bytes, reject modified bytes and metadata, and use
an ephemeral loopback HTTP server to check incomplete downloads. They never
install a package or contact the production update endpoint.

Keep `fixture.txt` byte-for-byte unchanged: its local attributes disable Git
newline conversion because the signature authenticates the exact file bytes.
