<?php
/*
Template Name: Press
*/

get_header();
the_post();

?>
<section id="home">
	<div class="container">
		<h2><?php the_title(); ?></h2>
				
				<?php the_content(); ?>
				
		<?php edit_post_link('Edit'); ?>
	</div>
</section>
<?php

get_footer();
