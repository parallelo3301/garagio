# Images stored on disk in the data directory's uploads/ folder and served from /uploads/<file>.
class Upload
  MAX_BYTES = 10.megabytes
  FILENAME_PATTERN = /\A[0-9a-f-]{36}\.[a-z0-9]{1,10}\z/i
  CONTENT_TYPES = {
    "jpg" => "image/jpeg", "jpeg" => "image/jpeg", "png" => "image/png",
    "gif" => "image/gif", "webp" => "image/webp", "avif" => "image/avif"
  }.freeze

  class Invalid < StandardError; end

  def self.directory
    Rails.configuration.x.uploads_dir.tap(&:mkpath)
  end

  def self.path?(value)
    value.to_s.start_with?("/uploads/") && value.delete_prefix("/uploads/").match?(FILENAME_PATTERN)
  end

  def self.file_for(filename)
    return unless filename.to_s.match?(FILENAME_PATTERN)

    path = directory.join(filename)
    path if path.file?
  end

  def self.content_type_for(filename)
    CONTENT_TYPES.fetch(File.extname(filename).delete_prefix(".").downcase, "application/octet-stream")
  end

  # Saves uploaded image files and returns their public paths.
  def self.store!(files)
    files = Array(files).select { |file| file.respond_to?(:read) }
    raise Invalid, "Choose at least one photo" if files.empty?
    if files.any? { |file| !file.content_type.to_s.start_with?("image/") || file.size > MAX_BYTES }
      raise Invalid, "Photos must be images no larger than 10 MB"
    end

    files.map do |file|
      filename = "#{SecureRandom.uuid}#{extension_for(file)}"
      File.binwrite(directory.join(filename), file.read)
      "/uploads/#{filename}"
    end
  end

  def self.extension_for(file)
    extension = file.original_filename.to_s[/\.[a-z0-9]{1,10}\z/i]&.downcase
    extension || { "image/jpeg" => ".jpg", "image/png" => ".png", "image/webp" => ".webp", "image/gif" => ".gif" }.fetch(file.content_type, "")
  end
end
