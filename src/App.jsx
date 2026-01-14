import { useState, useMemo } from 'react'
import './App.css'
import restaurants from './data/restaurants.json'

function App() {
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedId, setExpandedId] = useState(null)
  const [filterDoordash, setFilterDoordash] = useState(false)
  const [filterCity, setFilterCity] = useState('all')

  // Research panel state
  const [showResearchPanel, setShowResearchPanel] = useState(false)
  const [formSubmitted, setFormSubmitted] = useState(false)
  const [newRequest, setNewRequest] = useState({
    type: 'city',
    value: '',
    details: ''
  })

  // Get unique cities for filter dropdown
  const cities = useMemo(() => {
    const citySet = new Set(restaurants.map(r => r.city))
    return ['all', ...Array.from(citySet).sort()]
  }, [])

  // Filter restaurants based on all criteria
  const filteredRestaurants = useMemo(() => {
    return restaurants.filter(restaurant => {
      // DoorDash filter
      if (filterDoordash && !restaurant.doordash) {
        return false
      }

      // City filter
      if (filterCity !== 'all' && restaurant.city !== filterCity) {
        return false
      }

      // Search query filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase()
        const matchesSearch = (
          restaurant.name.toLowerCase().includes(query) ||
          restaurant.cuisine.toLowerCase().includes(query) ||
          restaurant.menuItems.some(item => item.name.toLowerCase().includes(query)) ||
          restaurant.notes.toLowerCase().includes(query) ||
          restaurant.gfOptions.toLowerCase().includes(query) ||
          restaurant.city.toLowerCase().includes(query)
        )
        if (!matchesSearch) return false
      }

      return true
    })
  }, [searchQuery, filterDoordash, filterCity])

  // Toggle expanded row
  const toggleExpanded = (id) => {
    setExpandedId(expandedId === id ? null : id)
  }

  // Handle Netlify form submission
  const handleFormSubmit = async (e) => {
    e.preventDefault()
    if (!newRequest.value.trim()) return

    const formData = new FormData()
    formData.append('form-name', 'restaurant-request')
    formData.append('request-type', newRequest.type)
    formData.append('request-value', newRequest.value.trim())
    formData.append('request-details', newRequest.details.trim())

    try {
      await fetch('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(formData).toString()
      })
      setFormSubmitted(true)
      setNewRequest({ type: 'city', value: '', details: '' })
    } catch (error) {
      alert('Something went wrong. Please try again.')
    }
  }

  // Reset form to submit another request
  const resetForm = () => {
    setFormSubmitted(false)
  }

  // Export to CSV
  const exportToCSV = () => {
    const headers = ['Name', 'Cuisine', 'City', 'Address', 'GF Options', 'Menu Items', 'DoorDash', 'Notes']
    const rows = filteredRestaurants.map(r => [
      r.name,
      r.cuisine,
      r.city,
      r.address,
      r.gfOptions,
      r.menuItems.map(item => `${item.name} ($${item.price.toFixed(2)})`).join('; '),
      r.doordash ? 'Yes' : 'No',
      r.notes
    ])

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')

    downloadFile(csvContent, 'gf-restaurants.csv', 'text/csv')
  }

  // Export to GeoJSON for Google Maps
  const exportToGeoJSON = () => {
    const geojson = {
      type: 'FeatureCollection',
      features: filteredRestaurants.map(r => ({
        type: 'Feature',
        properties: {
          name: r.name,
          description: `${r.cuisine}\n\nGF Options: ${r.gfOptions}\n\nMenu Items: ${r.menuItems.map(i => i.name).join(', ')}\n\n${r.notes}`,
          cuisine: r.cuisine,
          gfOptions: r.gfOptions,
          doordash: r.doordash
        },
        geometry: {
          type: 'Point',
          coordinates: [r.lng, r.lat]
        }
      }))
    }

    downloadFile(JSON.stringify(geojson, null, 2), 'gf-restaurants.geojson', 'application/geo+json')
  }

  // Helper to download file
  const downloadFile = (content, filename, mimeType) => {
    const blob = new Blob([content], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  // Clear all filters
  const clearFilters = () => {
    setSearchQuery('')
    setFilterDoordash(false)
    setFilterCity('all')
  }

  const hasActiveFilters = searchQuery || filterDoordash || filterCity !== 'all'

  return (
    <div className="app">
      <header className="header">
        <div className="header-content">
          <div>
            <h1>GF Local</h1>
            <p>Find gluten-free friendly restaurants in Cary & Raleigh</p>
          </div>
          <button
            className="btn btn-research"
            onClick={() => { setShowResearchPanel(!showResearchPanel); setFormSubmitted(false); }}
          >
            {showResearchPanel ? 'Close' : 'Request New Options'}
          </button>
        </div>
      </header>

      {/* Research Panel */}
      {showResearchPanel && (
        <div className="research-panel">
          {formSubmitted ? (
            <div className="success-message">
              <div className="success-icon">&#10003;</div>
              <h3>Thanks for your suggestion!</h3>
              <p>We'll look into it and add new options soon.</p>
              <button className="btn btn-secondary" onClick={resetForm}>
                Submit Another Request
              </button>
            </div>
          ) : (
            <div className="research-form-section">
              <h3>Request New Restaurant Options</h3>
              <p className="research-intro">
                Want more options? Submit a request and we'll research and add new restaurants for you.
              </p>

              <form
                name="restaurant-request"
                method="POST"
                data-netlify="true"
                onSubmit={handleFormSubmit}
                className="research-form"
              >
                <input type="hidden" name="form-name" value="restaurant-request" />

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="request-type">Request Type</label>
                    <select
                      id="request-type"
                      name="request-type"
                      value={newRequest.type}
                      onChange={(e) => setNewRequest(prev => ({ ...prev, type: e.target.value }))}
                    >
                      <option value="city">New City</option>
                      <option value="cuisine">Cuisine Type</option>
                      <option value="dietary">Dietary Need</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  <div className="form-group form-group-grow">
                    <label htmlFor="request-value">
                      {newRequest.type === 'city' && 'City Name'}
                      {newRequest.type === 'cuisine' && 'Cuisine (e.g., Thai, Italian, BBQ)'}
                      {newRequest.type === 'dietary' && 'Dietary Need (e.g., Vegan + GF, Dairy-Free)'}
                      {newRequest.type === 'other' && 'What are you looking for?'}
                    </label>
                    <input
                      id="request-value"
                      name="request-value"
                      type="text"
                      value={newRequest.value}
                      onChange={(e) => setNewRequest(prev => ({ ...prev, value: e.target.value }))}
                      placeholder={
                        newRequest.type === 'city' ? 'e.g., Durham, Chapel Hill' :
                        newRequest.type === 'cuisine' ? 'e.g., More Thai options' :
                        newRequest.type === 'dietary' ? 'e.g., Vegan + Gluten-Free' :
                        'Describe what you need...'
                      }
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="request-details">Additional Details (optional)</label>
                  <textarea
                    id="request-details"
                    name="request-details"
                    value={newRequest.details}
                    onChange={(e) => setNewRequest(prev => ({ ...prev, details: e.target.value }))}
                    placeholder="Any specific requirements, neighborhoods, or preferences..."
                    rows="2"
                  />
                </div>

                <div className="form-actions">
                  <button type="submit" className="btn btn-primary" disabled={!newRequest.value.trim()}>
                    Submit Request
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}

      <div className="controls">
        <div className="search-box">
          <input
            type="text"
            placeholder="Search restaurants, dishes, or cuisines..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="export-buttons">
          <button className="btn btn-secondary" onClick={exportToCSV}>
            Export CSV
          </button>
          <button className="btn btn-primary" onClick={exportToGeoJSON}>
            Export for Maps
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="filter-bar">
        <div className="filters">
          <label className="filter-checkbox">
            <input
              type="checkbox"
              checked={filterDoordash}
              onChange={(e) => setFilterDoordash(e.target.checked)}
            />
            <span className="checkmark"></span>
            DoorDash Only
          </label>

          <div className="filter-select">
            <label htmlFor="city-filter">City:</label>
            <select
              id="city-filter"
              value={filterCity}
              onChange={(e) => setFilterCity(e.target.value)}
            >
              {cities.map(city => (
                <option key={city} value={city}>
                  {city === 'all' ? 'All Cities' : city}
                </option>
              ))}
            </select>
          </div>
        </div>

        {hasActiveFilters && (
          <button className="btn-clear" onClick={clearFilters}>
            Clear Filters
          </button>
        )}
      </div>

      <p className="results-count">
        Showing {filteredRestaurants.length} of {restaurants.length} restaurants
        {hasActiveFilters && ' (filtered)'}
      </p>

      <div className="table-container">
        <div className="table-scroll">
          {filteredRestaurants.length > 0 ? (
            <table>
              <thead>
                <tr>
                  <th></th>
                  <th>Restaurant</th>
                  <th>GF Options</th>
                  <th>DoorDash</th>
                  <th>City</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {filteredRestaurants.map(restaurant => (
                  <>
                    <tr
                      key={restaurant.id}
                      className={`restaurant-row ${expandedId === restaurant.id ? 'expanded' : ''}`}
                      onClick={() => toggleExpanded(restaurant.id)}
                    >
                      <td className="expand-cell">
                        <span className={`expand-icon ${expandedId === restaurant.id ? 'open' : ''}`}>
                          &#9654;
                        </span>
                      </td>
                      <td>
                        <a
                          href={restaurant.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="restaurant-name"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {restaurant.name}
                        </a>
                        <div className="restaurant-cuisine">{restaurant.cuisine}</div>
                      </td>
                      <td>
                        <span className="badge badge-gf">{restaurant.gfOptions}</span>
                      </td>
                      <td>
                        {restaurant.doordash && restaurant.doordashUrl ? (
                          <a
                            href={restaurant.doordashUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="badge badge-doordash badge-link"
                            onClick={(e) => e.stopPropagation()}
                          >
                            DoorDash
                          </a>
                        ) : restaurant.doordash ? (
                          <span className="badge badge-doordash">DoorDash</span>
                        ) : (
                          <span className="badge badge-no">Dine-in only</span>
                        )}
                      </td>
                      <td>
                        <span className="city-name">{restaurant.city}</span>
                      </td>
                      <td className="notes-cell">{restaurant.notes}</td>
                    </tr>
                    {expandedId === restaurant.id && (
                      <tr key={`${restaurant.id}-expanded`} className="expanded-row">
                        <td colSpan="6">
                          <div className="expanded-content">
                            <div className="expanded-section">
                              <h4>Full Address</h4>
                              <p className="full-address">{restaurant.address}</p>
                            </div>
                            <div className="expanded-section">
                              <h4>Gluten-Free Menu Items</h4>
                              <div className="menu-grid">
                                {restaurant.menuItems.map((item, idx) => (
                                  <div key={idx} className="menu-item-card">
                                    <span className="menu-item-name">{item.name}</span>
                                    <span className="menu-item-price">${item.price.toFixed(2)}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty-state">
              <h3>No restaurants found</h3>
              <p>Try adjusting your search or filters</p>
              {hasActiveFilters && (
                <button className="btn btn-secondary" onClick={clearFilters}>
                  Clear All Filters
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default App
