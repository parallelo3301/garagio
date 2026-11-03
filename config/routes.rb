Rails.application.routes.draw do
  get "up" => "rails/health#show", as: :rails_health_check

  get "login" => "sessions#new"
  post "login" => "sessions#create"
  delete "logout" => "sessions#destroy"

  root "items#index"
  resources :items, only: %i[index show new create edit update destroy]
  resources :wiki_pages, path: "wiki", only: %i[index show new create edit update destroy] do
    post :preview, on: :collection
  end
  get "settings" => "manufacturers#index", as: :settings
  resources :manufacturers, only: %i[create destroy]

  post "uploads" => "uploads#create"
  get "uploads/:filename" => "uploads#show", as: :upload, constraints: { filename: /[^\/]+/ }, format: false

  namespace :api, defaults: { format: :json } do
    post "auth/login" => "auth#login"
    post "auth/logout" => "auth#logout"
    resources :items, only: %i[index show create update destroy]
    resources :manufacturers, only: %i[index create update destroy]
    resources :wiki_pages, path: "wiki", only: %i[index show create update destroy]
    post "uploads" => "uploads#create"
  end
end
