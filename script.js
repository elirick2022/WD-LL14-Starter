// Cache to avoid refetching the same meal details multiple times
const mealDetailsCache = new Map();

// Helper: fetch meal details by name using async/await
async function fetchMealDetailsByName(name) {
  // Return cached result if we have it
  if (mealDetailsCache.has(name)) {
    return mealDetailsCache.get(name);
  }

  try {
    const response = await fetch(
      `https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(
        name
      )}`
    );
    const data = await response.json();

    // Pick exact match if available, otherwise first result
    const meal =
      Array.isArray(data.meals) && data.meals.length
        ? data.meals.find((m) => m.strMeal === name) || data.meals[0]
        : null;

    mealDetailsCache.set(name, meal || null);
    return meal;
  } catch (err) {
    console.error("Error fetching meal details:", err);
    return null;
  }
}

// Helper: build ingredients array from a meal object
function buildIngredientsList(meal) {
  const ingredients = [];
  for (let i = 1; i <= 20; i++) {
    const ing = meal[`strIngredient${i}`];
    const measure = meal[`strMeasure${i}`];
    if (ing && ing.trim()) {
      ingredients.push(`${measure ? measure.trim() : ""} ${ing}`.trim());
    }
  }
  return ingredients;
}

// Helper: create or get the details container inside a card
function getOrCreateDetailsContainer(card) {
  let details = card.querySelector(".meal-details");
  if (!details) {
    details = document.createElement("div");
    details.className = "meal-details";
    // Minimal inline styles so details are readable without extra CSS files
    details.style.display = "none";
    details.style.marginTop = "8px";
    details.style.fontSize = "0.9rem";
    details.style.maxHeight = "300px";
    details.style.overflow = "auto";
    details.style.background = "#fff";
    details.style.borderTop = "1px solid #eee";
    details.style.paddingTop = "8px";
    card.appendChild(details);
  }
  return details;
}

// Helper: create a full-screen modal to display recipe details
function createRecipeModal(meal, fullMeal) {
  // Create modal overlay that covers the entire screen
  const modal = document.createElement("div");
  modal.className = "recipe-modal";
  modal.style.position = "fixed";
  modal.style.top = "0";
  modal.style.left = "0";
  modal.style.width = "100%";
  modal.style.height = "100%";
  modal.style.backgroundColor = "rgba(0, 0, 0, 0.7)";
  modal.style.display = "flex";
  modal.style.justifyContent = "center";
  modal.style.alignItems = "center";
  modal.style.zIndex = "1000";
  modal.style.padding = "20px";

  // Create modal content container
  const modalContent = document.createElement("div");
  modalContent.style.backgroundColor = "#fff";
  modalContent.style.borderRadius = "12px";
  modalContent.style.maxWidth = "800px";
  modalContent.style.maxHeight = "90vh";
  modalContent.style.overflow = "auto";
  modalContent.style.padding = "30px";
  modalContent.style.position = "relative";
  modalContent.style.boxShadow = "0 10px 40px rgba(0, 0, 0, 0.3)";

  // Create close button
  const closeButton = document.createElement("button");
  closeButton.textContent = "✕";
  closeButton.style.position = "absolute";
  closeButton.style.top = "15px";
  closeButton.style.right = "15px";
  closeButton.style.fontSize = "24px";
  closeButton.style.background = "none";
  closeButton.style.border = "none";
  closeButton.style.cursor = "pointer";
  closeButton.style.color = "#666";
  closeButton.style.padding = "5px 10px";

  // Close modal when clicking the close button
  closeButton.addEventListener("click", () => {
    document.body.removeChild(modal);
  });

  // Close modal when clicking outside the content
  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      document.body.removeChild(modal);
    }
  });

  // Build ingredients list from the full meal data
  const ingredients = buildIngredientsList(fullMeal);

  // Create the modal HTML content
  modalContent.innerHTML = `
    <h2 style="margin-top: 0; color: #333;">${fullMeal.strMeal}</h2>
    <img src="${meal.strMealThumb}" alt="${
    meal.strMeal
  }" style="width: 100%; max-width: 500px; border-radius: 8px; margin-bottom: 20px;">
    <p><strong>Category:</strong> ${
      fullMeal.strCategory || "N/A"
    } | <strong>Area:</strong> ${fullMeal.strArea || "N/A"}</p>
    <h3 style="color: #4CAF50;">Ingredients</h3>
    <ul style="line-height: 1.8;">
      ${ingredients.map((i) => `<li>${i}</li>`).join("")}
    </ul>
    <h3 style="color: #4CAF50;">Instructions</h3>
    <p style="line-height: 1.6; white-space: pre-line;">${
      fullMeal.strInstructions || "No instructions available."
    }</p>
  `;

  // Add close button to modal content
  modalContent.insertBefore(closeButton, modalContent.firstChild);

  // Add modal content to modal overlay
  modal.appendChild(modalContent);

  // Add modal to the page
  document.body.appendChild(modal);
}

// Populate the area dropdown when the page loads (async/await version)
window.addEventListener("DOMContentLoaded", async function () {
  const areaSelect = document.getElementById("area-select");
  areaSelect.innerHTML = '<option value="">Select Area</option>';

  try {
    const response = await fetch(
      "https://www.themealdb.com/api/json/v1/1/list.php?a=list"
    );
    const data = await response.json();

    if (data.meals) {
      data.meals.forEach((areaObj) => {
        const option = document.createElement("option");
        option.value = areaObj.strArea;
        option.textContent = areaObj.strArea;
        areaSelect.appendChild(option);
      });
    }
  } catch (err) {
    console.error("Error loading areas:", err);
  }
});

// Helper: check if a meal contains an excluded ingredient
function mealContainsIngredient(meal, excludedIngredient) {
  // If no ingredient to exclude, don't filter anything
  if (!excludedIngredient || excludedIngredient.trim() === "") {
    return false;
  }

  // Convert excluded ingredient to lowercase for case-insensitive comparison
  const excludedLower = excludedIngredient.trim().toLowerCase();

  // Check all 20 possible ingredient slots
  for (let i = 1; i <= 20; i++) {
    const ingredient = meal[`strIngredient${i}`];
    if (ingredient && ingredient.toLowerCase().includes(excludedLower)) {
      return true; // Found the excluded ingredient
    }
  }

  return false; // Excluded ingredient not found
}

// When the user selects an area, fetch and display meals for that area (async/await)
// Also add hover to expand and show recipe details
document
  .getElementById("area-select")
  .addEventListener("change", async function () {
    const area = this.value;
    const resultsDiv = document.getElementById("results");
    resultsDiv.innerHTML = ""; // Clear previous results

    if (!area) return;

    try {
      const response = await fetch(
        `https://www.themealdb.com/api/json/v1/1/filter.php?a=${encodeURIComponent(
          area
        )}`
      );
      const data = await response.json();

      if (data.meals) {
        // Get the excluded ingredient from the textbox
        const excludeInput = document.getElementById("exclude-ingredient");
        const excludedIngredient = excludeInput.value;

        // Counter for filtered recipes
        let displayedCount = 0;

        // Loop through each meal and display it if it doesn't contain excluded ingredient
        for (const meal of data.meals) {
          // Fetch the full meal details to check ingredients
          const fullMeal = await fetchMealDetailsByName(meal.strMeal);

          // Skip this meal if it contains the excluded ingredient
          if (
            fullMeal &&
            mealContainsIngredient(fullMeal, excludedIngredient)
          ) {
            continue; // Skip to next meal
          }

          // Create a simple card for each meal
          const mealDiv = document.createElement("div");
          mealDiv.className = "meal";

          const title = document.createElement("h3");
          title.textContent = meal.strMeal;

          const img = document.createElement("img");
          img.src = meal.strMealThumb;
          img.alt = meal.strMeal;

          mealDiv.appendChild(title);
          mealDiv.appendChild(img);
          resultsDiv.appendChild(mealDiv);

          displayedCount++;

          // Click: open full-screen modal with recipe details
          mealDiv.addEventListener("click", async () => {
            // Fetch the full meal details (use cached version if available)
            const fullMealForModal = await fetchMealDetailsByName(meal.strMeal);

            if (!fullMealForModal) {
              alert("Unable to load recipe details.");
              return;
            }

            // Create and display the modal
            createRecipeModal(meal, fullMealForModal);
          });

          // Hover: just show a preview on the card (simplified)
          mealDiv.addEventListener("mouseenter", async () => {
            const details = getOrCreateDetailsContainer(mealDiv);
            details.style.display = "block";
            details.innerHTML = "Click to view full recipe...";
          });

          // Remove preview when mouse leaves
          mealDiv.addEventListener("mouseleave", () => {
            const details = mealDiv.querySelector(".meal-details");
            if (details) details.style.display = "none";
          });
        }

        // Show message if all meals were filtered out
        if (displayedCount === 0) {
          resultsDiv.textContent = excludedIngredient
            ? `No meals found without "${excludedIngredient}".`
            : "No meals found for this area.";
        }
      } else {
        resultsDiv.textContent = "No meals found for this area.";
      }
    } catch (err) {
      console.error("Error loading meals:", err);
      resultsDiv.textContent = "Error loading meals. Please try again.";
    }
  });

// Add event listener to the exclude ingredient textbox
// Re-run the search when user changes the filter
document
  .getElementById("exclude-ingredient")
  .addEventListener("input", function () {
    // Trigger the area selection change to refresh results with new filter
    const areaSelect = document.getElementById("area-select");
    if (areaSelect.value) {
      // Create and dispatch a change event to reload the results
      const event = new Event("change");
      areaSelect.dispatchEvent(event);
    }
  });
