from storages.backends.s3 import S3Storage

class AutoCreateS3Storage(S3Storage):
    """
    S3Storage subclass that automatically verifies if the configured bucket exists,
    and creates it if it is missing.
    """
    _bucket_verified = False

    def _save(self, name, content):
        if not self._bucket_verified:
            try:
                # Check if bucket exists
                self.connection.meta.client.head_bucket(Bucket=self.bucket_name)
                self.__class__._bucket_verified = True
            except Exception:
                try:
                    # Bucket doesn't exist or isn't accessible, try to create it
                    self.connection.create_bucket(Bucket=self.bucket_name)
                    self.__class__._bucket_verified = True
                except Exception:
                    # Let the original save operation raise the error if creation fails
                    pass
        return super()._save(name, content)
