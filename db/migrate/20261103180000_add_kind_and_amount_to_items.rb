class AddKindAndAmountToItems < ActiveRecord::Migration[8.1]
  def change
    add_column :items, :kind, :string, null: false, default: "tool"
    add_column :items, :amount, :string, null: false, default: ""
    add_index :items, :kind
  end
end
