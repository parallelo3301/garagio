require "test_helper"

class UploadTest < ActiveSupport::TestCase
  include ActionDispatch::TestProcess::FixtureFile

  test "stores images and resolves them back" do
    paths = Upload.store!([ fixture_file_upload("photo.png", "image/png") ])
    assert_equal 1, paths.size
    assert Upload.path?(paths.first)
    file = Upload.file_for(paths.first.delete_prefix("/uploads/"))
    assert file.file?
    assert_equal "image/png", Upload.content_type_for(file.basename.to_s)
  end

  test "rejects non-images, empty input and traversal" do
    assert_raises(Upload::Invalid) { Upload.store!([]) }
    assert_raises(Upload::Invalid) { Upload.store!([ fixture_file_upload("photo.png", "text/plain") ]) }
    assert_nil Upload.file_for("../db.sqlite")
    assert_not Upload.path?("/uploads/../secret_key_base")
  end
end
